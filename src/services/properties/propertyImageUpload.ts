import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadPropertyImageResult = {
  /** Best URL to show on property cards (optimized thumb from edge fn, or original upload). */
  displayUrl: string | null;
};

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
  const fileExt = file.name.split(".").pop() || "jpg";
  const storagePath = `${orgId}/${propertyId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("property-images")
    .upload(storagePath, file);

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: urlData } = supabase.storage.from("property-images").getPublicUrl(storagePath);
  const originalPublicUrl = urlData.publicUrl;

  const { error: updateError } = await supabase
    .from("properties")
    .update({ thumbnail_url: originalPublicUrl })
    .eq("id", propertyId);

  if (updateError) {
    console.error("[propertyImageUpload] Failed to set thumbnail_url:", updateError);
  }

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
    console.error("[propertyImageUpload] process-image invoke error:", processError);
  }

  let displayUrl: string | null = !updateError ? originalPublicUrl : null;

  if (
    !processError &&
    processData &&
    typeof processData === "object" &&
    "ok" in processData &&
    (processData as { ok?: boolean }).ok === true &&
    (processData as { data?: { thumbnailUrl?: string } }).data?.thumbnailUrl
  ) {
    displayUrl = (processData as { data: { thumbnailUrl: string } }).data.thumbnailUrl;
  }

  return { displayUrl };
}
