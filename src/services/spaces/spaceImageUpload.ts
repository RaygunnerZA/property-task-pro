import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadSpaceImageResult = {
  displayUrl: string;
  storagePath: string;
};

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

function fileExtension(fileName: string): string {
  return (fileName.split(".").pop() || "").trim().toLowerCase();
}

function resolveContentType(file: File): string {
  const mime = (file.type || "").toLowerCase();
  if (mime && ALLOWED_MIME.has(mime)) return mime;
  const ext = fileExtension(file.name);
  const byExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };
  return byExt[ext] ?? mime ?? "image/jpeg";
}

export function validateSpaceImageFile(file: File): void {
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`Image is ${mb}MB. Space images must be 10MB or smaller.`);
  }
  const ext = fileExtension(file.name);
  const mime = (file.type || "").toLowerCase();
  const mimeOk = mime ? ALLOWED_MIME.has(mime) : false;
  const extOk = ALLOWED_EXT.has(ext);
  if (!mimeOk && !extOk) {
    throw new Error("Use a JPEG, PNG, WebP, or HEIC image.");
  }
}

type ProcessImagePayload = {
  ok?: boolean;
  data?: { thumbnailUrl?: string };
};

function thumbnailFromProcessResponse(processData: unknown): string | null {
  if (!processData || typeof processData !== "object") return null;
  const payload = processData as ProcessImagePayload;
  if (payload.ok === true && payload.data?.thumbnailUrl) {
    return payload.data.thumbnailUrl;
  }
  return null;
}

/**
 * Uploads a space image to `property-images` under `…/spaces/…`.
 * When `spaceId` is set, runs process-image and updates `spaces.thumbnail_url`.
 */
export async function uploadSpaceImage(
  supabase: SupabaseClient,
  options: {
    orgId: string;
    propertyId: string;
    file: File;
    spaceId?: string;
  }
): Promise<UploadSpaceImageResult> {
  const { orgId, propertyId, file, spaceId } = options;
  validateSpaceImageFile(file);

  const fileExt = fileExtension(file.name) || "jpg";
  const folder = spaceId ? `${orgId}/${propertyId}/spaces/${spaceId}` : `${orgId}/${propertyId}/spaces/pending`;
  const storagePath = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const contentType = resolveContentType(file);

  const { error: uploadError } = await supabase.storage
    .from("property-images")
    .upload(storagePath, file, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    const msg = uploadError.message || "Failed to upload image to storage.";
    if (/bucket not found/i.test(msg)) {
      throw new Error(
        "Image storage is not set up yet. Ask an admin to run the latest database migrations (property-images bucket)."
      );
    }
    throw new Error(msg);
  }

  const { data: urlData } = supabase.storage.from("property-images").getPublicUrl(storagePath);
  let displayUrl = urlData.publicUrl;

  if (spaceId) {
    const { error: updateError } = await supabase
      .from("spaces")
      .update({ thumbnail_url: displayUrl })
      .eq("id", spaceId);
    if (updateError) throw updateError;

    const { data: processData, error: processError } = await supabase.functions.invoke(
      "process-image",
      {
        body: {
          bucket: "property-images",
          path: storagePath,
          recordId: spaceId,
          table: "spaces",
        },
      }
    );

    if (processError) {
      console.warn("[spaceImageUpload] process-image invoke error:", processError);
    } else {
      const optimized = thumbnailFromProcessResponse(processData);
      if (optimized) displayUrl = optimized;
    }
  }

  return { displayUrl, storagePath };
}
