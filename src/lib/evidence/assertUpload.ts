import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkEvidenceUpload,
  type EvidenceUploadCheck,
} from "@/lib/evidence/uploadLimits";
import { trackQuotaBlocked } from "@/lib/billing/quotaTelemetry";

type AssertOpts = {
  orgId: string;
  file: File;
  storageUsedBytes?: number;
  evidenceBytesAllowance?: number;
  /** Skip remote RPC (local-only). Default false. */
  localOnly?: boolean;
};

/**
 * Client + server evidence gate for new uploads.
 * Existing files are never revoked by this check.
 */
export async function assertEvidenceUpload(
  supabase: SupabaseClient,
  opts: AssertOpts
): Promise<EvidenceUploadCheck> {
  const local = checkEvidenceUpload({
    file: opts.file,
    storageUsedBytes: opts.storageUsedBytes ?? 0,
    evidenceBytesAllowance:
      opts.evidenceBytesAllowance ?? Number.MAX_SAFE_INTEGER,
    enforceQuota:
      opts.evidenceBytesAllowance !== undefined &&
      opts.evidenceBytesAllowance > 0,
  });
  if (!local.ok) {
    if (local.reason === "quota") {
      trackQuotaBlocked(opts.orgId, "evidence");
    }
    return local;
  }
  if (opts.localOnly) return local;

  const { data, error } = await supabase.rpc("assert_evidence_upload_allowed", {
    p_org_id: opts.orgId,
    p_file_size: opts.file.size,
    p_mime_type: opts.file.type || null,
  });

  if (error) {
    console.warn("[evidence] assert_evidence_upload_allowed", error.message);
    return local;
  }

  const payload = (data ?? {}) as {
    allowed?: boolean;
    reason?: string;
    message?: string;
  };
  if (payload.allowed !== false) return { ok: true };

  const reason =
    payload.reason === "type" ||
    payload.reason === "size" ||
    payload.reason === "quota" ||
    payload.reason === "malware"
      ? payload.reason
      : "quota";

  if (reason === "quota") {
    trackQuotaBlocked(opts.orgId, "evidence");
  }

  return {
    ok: false,
    reason,
    message:
      payload.message || "Upload not allowed under current evidence limits.",
  };
}
