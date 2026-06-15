import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntakeItem } from "@/types/intake-item";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 120);

export function validateIntakeFile(file: File): void {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`"${file.name}" exceeds 50MB limit`);
  }
}

export async function uploadIntakeFile(
  supabase: SupabaseClient,
  options: { orgId: string; file: File }
): Promise<IntakeItem> {
  const { orgId, file } = options;
  validateIntakeFile(file);

  const intakeId = crypto.randomUUID();
  const cleanedName = sanitizeFileName(file.name) || `upload-${Date.now()}`;
  const storagePath = `orgs/${orgId}/inbox/${intakeId}/${Date.now()}-${cleanedName}`;

  const { error: uploadError } = await supabase.storage
    .from("inbox")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw new Error(`Upload failed for "${file.name}": ${uploadError.message}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: rpcError } = await (supabase as any).rpc("create_intake_item_from_upload", {
    p_id: intakeId,
    p_storage_path: storagePath,
    p_file_name: file.name,
    p_mime_type: file.type || null,
    p_file_size: file.size,
  });

  if (rpcError) {
    await supabase.storage.from("inbox").remove([storagePath]);
    throw new Error(`Failed to create intake record for "${file.name}": ${rpcError.message}`);
  }

  return data as IntakeItem;
}

export async function triggerIntakeProcess(
  supabase: SupabaseClient,
  intakeItemId: string
): Promise<void> {
  const { error } = await supabase.functions.invoke("intake-process", {
    body: { intake_item_id: intakeItemId },
  });
  if (error) {
    console.warn("[intake] intake-process invoke error:", error);
  }
}

export async function confirmIntakeItem(
  supabase: SupabaseClient,
  intakeItemId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("update_intake_item_status", {
    p_intake_item_id: intakeItemId,
    p_status: "confirmed",
  });
  if (error) {
    throw new Error(error.message || "Could not confirm intake item");
  }
}

export async function ignoreIntakeItem(
  supabase: SupabaseClient,
  intakeItemId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("update_intake_item_status", {
    p_intake_item_id: intakeItemId,
    p_status: "ignored",
  });
  if (error) {
    throw new Error(error.message || "Could not ignore intake item");
  }
}

export async function downloadInboxFile(
  supabase: SupabaseClient,
  storagePath: string,
  fileName: string,
  mimeType: string
): Promise<File> {
  const { data, error } = await supabase.storage.from("inbox").download(storagePath);
  if (error || !data) {
    throw new Error(error?.message || "Could not download file from inbox");
  }
  return new File([data], fileName, { type: mimeType || data.type || "application/octet-stream" });
}
