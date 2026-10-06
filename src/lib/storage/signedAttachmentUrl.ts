import { supabase } from "@/integrations/supabase/client";
import { isSampleIllustrationUrl } from "@/lib/sampleIllustrationUrl";

/** Buckets a signed-in member may open through their own JWT. */
const SIGNABLE_BUCKETS = new Set([
  "task-images",
  "inbox",
  "property-plans",
  "property-plan-pages",
]);

export function storageObjectFromFileUrl(
  fileUrl: string
): { bucket: string; path: string } | null {
  const trimmed = fileUrl.trim();
  if (!trimmed || isSampleIllustrationUrl(trimmed)) return null;
  let pathname = trimmed;
  try {
    pathname = new URL(trimmed, "https://local.invalid").pathname;
  } catch {
    return null;
  }
  const match = pathname.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/
  );
  if (!match) return null;
  const bucket = decodeURIComponent(match[1]);
  const path = decodeURIComponent(match[2]).split("?")[0];
  if (!SIGNABLE_BUCKETS.has(bucket) || !path) return null;
  return { bucket, path };
}

/**
 * Short-lived URL for a storage object the member can already read.
 * Returns null for sample illustrations and for anything that is not a
 * known bucket object. Callers must not fall back to the raw object URL.
 */
export async function createMemberSignedUrl(
  fileUrl: string,
  expiresIn = 120
): Promise<string | null> {
  const object = storageObjectFromFileUrl(fileUrl);
  if (!object) return null;
  const { data, error } = await supabase.storage
    .from(object.bucket)
    .createSignedUrl(object.path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
