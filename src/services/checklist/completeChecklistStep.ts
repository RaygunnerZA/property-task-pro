import { supabase as _supabase } from "@/integrations/supabase/client";
import type { ChecklistStepResponseInput } from "@/lib/checklistStepResponse";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

type GeoPayload = {
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
};

/** Reuse location for rapid successive completions (~1 min). */
const GEO_CACHE_TTL_MS = 60_000;
let geoCache: { value: GeoPayload | null; at: number; inflight: Promise<GeoPayload | null> | null } = {
  value: null,
  at: 0,
  inflight: null,
};

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(header)?.[1] || "image/png";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function readBrowserGeoOnce(): Promise<GeoPayload | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy ?? null,
        }),
      () => resolve(null),
      // Prefer cached GPS; short timeout so background work stays light.
      { enableHighAccuracy: false, timeout: 4000, maximumAge: GEO_CACHE_TTL_MS }
    );
  });
}

/** Cached geo — safe to call in parallel; shares one in-flight request. */
export async function getChecklistGeoCached(): Promise<GeoPayload | null> {
  const now = Date.now();
  if (geoCache.value && now - geoCache.at < GEO_CACHE_TTL_MS) {
    return geoCache.value;
  }
  if (geoCache.inflight) return geoCache.inflight;

  geoCache.inflight = readBrowserGeoOnce()
    .then((value) => {
      geoCache.value = value;
      geoCache.at = Date.now();
      geoCache.inflight = null;
      return value;
    })
    .catch(() => {
      geoCache.inflight = null;
      return null;
    });

  return geoCache.inflight;
}

async function uploadSubtaskEvidence(params: {
  orgId: string;
  taskId: string;
  subtaskId: string;
  file: Blob;
  fileName: string;
  fileType: string;
  /** When false, skip task-gallery rollup (signatures stay checklist-only). */
  rollupToTaskGallery?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<{ attachmentId: string; fileUrl: string }> {
  const {
    orgId,
    taskId,
    subtaskId,
    file,
    fileName,
    fileType,
    rollupToTaskGallery = true,
    metadata,
  } = params;
  const ext = fileName.split(".").pop() || "bin";
  const path = `org/${orgId}/tasks/${taskId}/subtasks/${subtaskId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("task-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: fileType || undefined,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage.from("task-images").getPublicUrl(path);

  const { data: attachment, error: attachError } = await supabase
    .from("attachments")
    .insert({
      org_id: orgId,
      parent_type: "subtask",
      parent_id: subtaskId,
      file_url: urlData.publicUrl,
      file_name: fileName,
      file_type: fileType || null,
      file_size: file.size,
      upload_status: "complete",
      metadata: metadata ?? {},
    })
    .select("id")
    .single();

  if (attachError || !attachment?.id) {
    throw new Error(attachError?.message || "Failed to create attachment");
  }

  // Photos/files may appear in the task gallery; signatures must not — they are
  // viewed via checklist "View evidence" and must not become the task thumbnail.
  if (rollupToTaskGallery) {
    await supabase.from("attachments").insert({
      org_id: orgId,
      parent_type: "task",
      parent_id: taskId,
      file_url: urlData.publicUrl,
      file_name: fileName,
      file_type: fileType || null,
      file_size: file.size,
      upload_status: "complete",
      metadata: metadata ?? {},
    });
  }

  return { attachmentId: attachment.id as string, fileUrl: urlData.publicUrl as string };
}

async function patchResponseGeo(params: {
  orgId: string;
  subtaskId: string;
  baseJson: Record<string, unknown>;
}): Promise<void> {
  const geo = await getChecklistGeoCached();
  if (!geo) return;
  const { error } = await supabase
    .from("subtasks")
    .update({
      response_json: { ...params.baseJson, geo },
    })
    .eq("id", params.subtaskId)
    .eq("org_id", params.orgId);
  if (error && import.meta.env.DEV) {
    console.warn("[completeChecklistStep] geo patch failed:", error.message);
  }
}

export type CompleteChecklistStepParams = {
  orgId: string;
  taskId: string;
  subtaskId: string;
  stepType: string;
  response: ChecklistStepResponseInput;
  userId: string;
};

/**
 * Records a checklist step response immediately, then attaches geo in the background.
 * Location is cached ~60s so rapid successive completions stay fast.
 */
export async function completeChecklistStep({
  orgId,
  taskId,
  subtaskId,
  stepType,
  response,
  userId,
}: CompleteChecklistStepParams): Promise<void> {
  const now = new Date().toISOString();

  let attachmentId: string | null = null;
  let fileMeta: Record<string, unknown> = {};

  if (response.signatureDataUrl) {
    const blob = dataUrlToBlob(response.signatureDataUrl);
    const uploaded = await uploadSubtaskEvidence({
      orgId,
      taskId,
      subtaskId,
      file: blob,
      fileName: "signature.png",
      fileType: "image/png",
      rollupToTaskGallery: false,
      metadata: { evidence_kind: "signature" },
    });
    attachmentId = uploaded.attachmentId;
    fileMeta = { signature_image: true, file_url: uploaded.fileUrl, evidence_kind: "signature" };
  } else if (response.file) {
    const uploaded = await uploadSubtaskEvidence({
      orgId,
      taskId,
      subtaskId,
      file: response.file,
      fileName: response.file.name,
      fileType: response.file.type || "application/octet-stream",
      rollupToTaskGallery: stepType === "photo",
      metadata: { evidence_kind: stepType === "photo" ? "photo" : "file" },
    });
    attachmentId = uploaded.attachmentId;
    fileMeta = {
      file_name: response.file.name,
      file_type: response.file.type,
      file_size: response.file.size,
      file_url: uploaded.fileUrl,
    };
  }

  // Prefer warm cache synchronously so first paint of metadata can include geo
  // without blocking when cold.
  const warmGeo =
    geoCache.value && Date.now() - geoCache.at < GEO_CACHE_TTL_MS ? geoCache.value : null;

  const value = response.value.trim();
  const responseJson: Record<string, unknown> = {
    step_type: stepType,
    recorded_at: now,
    recorded_by: userId,
    ...(warmGeo ? { geo: warmGeo } : {}),
    ...fileMeta,
    ...(response.metadata ?? {}),
  };

  const isSignature = stepType === "signature";
  const updates: Record<string, unknown> = {
    response_value:
      value ||
      (attachmentId
        ? stepType === "photo"
          ? "photo"
          : stepType === "file"
            ? "file"
            : isSignature
              ? "signed"
              : value
        : null),
    response_json: responseJson,
    completed_by: userId,
    completed_at: now,
    is_completed: true,
    completed: true,
    updated_at: now,
    updated_by: userId,
  };

  if (attachmentId) {
    updates.response_attachment_id = attachmentId;
  }

  if (isSignature) {
    updates.signed_by = userId;
    updates.signed_at = now;
    updates.requires_signature = true;
    if (!updates.response_value) updates.response_value = "signed";
  }

  const { error } = await supabase.from("subtasks").update(updates).eq("id", subtaskId).eq("org_id", orgId);
  if (error) throw new Error(error.message);

  // Never block completion on GPS — enrich metadata in the background.
  if (!warmGeo) {
    void patchResponseGeo({ orgId, subtaskId, baseJson: responseJson });
  } else {
    // Refresh cache in background for the next step without awaiting.
    void getChecklistGeoCached();
  }
}

export async function clearChecklistStepResponse(params: {
  orgId: string;
  subtaskId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("subtasks")
    .update({
      response_value: null,
      response_json: {},
      completed_by: null,
      completed_at: null,
      response_attachment_id: null,
      signed_by: null,
      signed_at: null,
      is_completed: false,
      completed: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.subtaskId)
    .eq("org_id", params.orgId);
  if (error) throw new Error(error.message);
}
