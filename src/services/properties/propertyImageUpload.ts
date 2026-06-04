import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadPropertyImageResult = {
  /** Best URL to show on property cards (optimized thumb from edge fn, or original upload). */
  displayUrl: string;
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

export function validatePropertyImageFile(file: File): void {
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(`Image is ${mb}MB. Property photos must be 10MB or smaller.`);
  }
  const ext = fileExtension(file.name);
  const mime = (file.type || "").toLowerCase();
  const mimeOk = mime ? ALLOWED_MIME.has(mime) : false;
  const extOk = ALLOWED_EXT.has(ext);
  if (!mimeOk && !extOk) {
    throw new Error("Use a JPEG, PNG, WebP, or HEIC photo.");
  }
}

type ProcessImagePayload = {
  ok?: boolean;
  data?: { thumbnailUrl?: string };
  error?: string;
};

function thumbnailFromProcessResponse(processData: unknown): string | null {
  if (!processData || typeof processData !== "object") return null;
  const payload = processData as ProcessImagePayload;
  if (payload.ok === true && payload.data?.thumbnailUrl) {
    return payload.data.thumbnailUrl;
  }
  return null;
}

async function setPropertyThumbnailUrl(
  supabase: SupabaseClient,
  propertyId: string,
  thumbnailUrl: string
): Promise<void> {
  const { error: rpcError } = await supabase.rpc("update_property_thumbnail", {
    p_property_id: propertyId,
    p_thumbnail_url: thumbnailUrl,
  });

  if (!rpcError) return;

  const { error: updateError } = await supabase
    .from("properties")
    .update({ thumbnail_url: thumbnailUrl })
    .eq("id", propertyId);

  if (updateError) {
    throw new Error(
      updateError.message ||
        rpcError.message ||
        "Could not save the property photo. Check that you belong to this organisation."
    );
  }
}

/**
 * Uploads a property photo to `property-images`, sets `properties.thumbnail_url` to the original
 * file's public URL immediately so list cards show the image without waiting for the edge function,
 * then invokes `process-image` to write an optimized WebP thumbnail URL to the same column.
 */
export async function uploadPropertyImageWithThumbnail(
  supabase: SupabaseClient,
  options: { orgId: string; propertyId: string; file: File }
): Promise<UploadPropertyImageResult> {
  const { orgId, propertyId, file } = options;
  validatePropertyImageFile(file);

  const fileExt = fileExtension(file.name) || "jpg";
  const storagePath = `${orgId}/${propertyId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const contentType = resolveContentType(file);

  const { error: uploadError } = await supabase.storage
    .from("property-images")
    .upload(storagePath, file, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload image to storage.");
  }

  const { data: urlData } = supabase.storage.from("property-images").getPublicUrl(storagePath);
  const originalPublicUrl = urlData.publicUrl;

  await setPropertyThumbnailUrl(supabase, propertyId, originalPublicUrl);

  let displayUrl = originalPublicUrl;

  const { data: processData, error: processError } = await supabase.functions.invoke(
    "process-image",
    {
      body: {
        bucket: "property-images",
        path: storagePath,
        recordId: propertyId,
        table: "properties",
      },
    }
  );

  if (processError) {
    console.warn("[propertyImageUpload] process-image invoke error:", processError);
  } else {
    const optimized = thumbnailFromProcessResponse(processData);
    if (optimized) {
      displayUrl = optimized;
    }
  }

  return { displayUrl };
}
