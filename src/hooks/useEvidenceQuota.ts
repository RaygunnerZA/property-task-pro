import { useCallback, useMemo } from "react";
import { useOrgEntitlements } from "@/hooks/useOrgEntitlements";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  checkEvidenceUpload,
  evidenceQuotaWarning,
  formatEvidenceBytes,
  type EvidenceUploadCheck,
} from "@/lib/evidence/uploadLimits";
import type { OrgUsageMetrics } from "@/lib/entitlements";

export type EvidenceByProperty = {
  property_id: string;
  bytes: number;
};

/**
 * Org-pooled evidence quota for upload gates and Billing UX.
 * Enforcement blocks new uploads only — never revokes existing file reads.
 */
export function useEvidenceQuota() {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();
  const { entitlements, usage, metrics, loading, refresh } = useOrgEntitlements();

  const storageUsedBytes = usage?.storage_used_bytes ?? 0;
  const allowance = entitlements.evidence_bytes_allowance;
  const warning = useMemo(
    () => evidenceQuotaWarning(storageUsedBytes, allowance),
    [storageUsedBytes, allowance]
  );

  const byProperty = useMemo((): EvidenceByProperty[] => {
    const raw = (metrics as OrgUsageMetrics & { evidence_by_property?: unknown })
      .evidence_by_property;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const o = row as Record<string, unknown>;
        if (typeof o.property_id !== "string") return null;
        return {
          property_id: o.property_id,
          bytes: typeof o.bytes === "number" ? o.bytes : Number(o.bytes) || 0,
        };
      })
      .filter((x): x is EvidenceByProperty => !!x);
  }, [metrics]);

  const checkFile = useCallback(
    (file: File, enforceQuota = true): EvidenceUploadCheck =>
      checkEvidenceUpload({
        file,
        storageUsedBytes,
        evidenceBytesAllowance: allowance,
        enforceQuota,
      }),
    [storageUsedBytes, allowance]
  );

  /** Server-side assert (authoritative). Call before Storage upload when possible. */
  const assertServerAllowed = useCallback(
    async (file: File): Promise<EvidenceUploadCheck> => {
      if (!orgId) {
        return { ok: false, reason: "type", message: "No active organisation" };
      }
      const local = checkFile(file, true);
      if (!local.ok) return local;

      const { data, error } = await supabase.rpc("assert_evidence_upload_allowed", {
        p_org_id: orgId,
        p_file_size: file.size,
        p_mime_type: file.type || null,
      });

      if (error) {
        // Fail open on RPC missing/errors so uploads aren't bricked mid-rollout;
        // local check already ran.
        console.warn("[evidence] assert_evidence_upload_allowed", error.message);
        return local;
      }

      const payload = (data ?? {}) as {
        allowed?: boolean;
        reason?: "type" | "size" | "quota" | "malware" | "auth";
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

      return {
        ok: false,
        reason,
        message:
          payload.message ||
          "Upload not allowed under current evidence limits.",
      };
    },
    [orgId, supabase, checkFile]
  );

  return {
    storageUsedBytes,
    allowance,
    warning,
    byProperty,
    loading,
    refresh,
    checkFile,
    assertServerAllowed,
    formatBytes: formatEvidenceBytes,
    usageRatio: allowance > 0 ? storageUsedBytes / allowance : 0,
    isOverQuota: allowance > 0 && storageUsedBytes >= allowance,
  };
}
