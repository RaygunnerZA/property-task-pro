/**
 * Phase 4 — evidence upload limits.
 * @Docs/20_Billing.md §20.2 · @Docs/28 Phase 4
 *
 * Soft client checks before transfer. Org-pooled bytes use entitlements;
 * never revoke read of existing files for overage alone.
 */

/** Aligned with task-images Storage bucket (50MB hard) and product caps. */
export const EVIDENCE_MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MiB
export const EVIDENCE_MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MiB
export const EVIDENCE_MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MiB
export const EVIDENCE_MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MiB
export const EVIDENCE_MAX_OTHER_BYTES = 20 * 1024 * 1024; // 20 MiB

/** One storage pack unit (Stripe add-on). */
export const EVIDENCE_STORAGE_PACK_BYTES = 10 * 1024 * 1024 * 1024; // 10 GiB

export const EVIDENCE_ALLOWED_MIME_PREFIXES = [
  "image/",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "text/plain",
] as const;

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "dll",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "ps1",
  "vbs",
  "js",
  "jar",
  "apk",
  "dmg",
  "pkg",
  "sh",
  "bash",
]);

const BLOCKED_MIME = new Set([
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-dosexec",
  "application/java-archive",
  "application/x-sh",
  "application/x-csh",
]);

export type EvidenceUploadCheck =
  | { ok: true }
  | { ok: false; reason: "type" | "size" | "quota" | "malware"; message: string };

function getExtension(fileName: string): string {
  return (fileName.split(".").pop() || "").trim().toLowerCase();
}

function maxBytesForFile(file: File | { type: string; size: number }): number {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return EVIDENCE_MAX_IMAGE_BYTES;
  if (mime === "application/pdf") return EVIDENCE_MAX_PDF_BYTES;
  if (mime.startsWith("video/")) return EVIDENCE_MAX_VIDEO_BYTES;
  if (mime.startsWith("audio/")) return EVIDENCE_MAX_AUDIO_BYTES;
  return EVIDENCE_MAX_OTHER_BYTES;
}

export function isAllowedEvidenceMime(mime: string): boolean {
  if (!mime) return false;
  const m = mime.toLowerCase();
  if (BLOCKED_MIME.has(m)) return false;
  return EVIDENCE_ALLOWED_MIME_PREFIXES.some(
    (p) => m === p || m.startsWith(p)
  );
}

/** Lightweight malware / abuse gate — extension + MIME denylist (not a virus scanner). */
export function isBlockedEvidenceFile(file: {
  name: string;
  type: string;
}): boolean {
  const ext = getExtension(file.name);
  if (BLOCKED_EXTENSIONS.has(ext)) return true;
  const mime = (file.type || "").toLowerCase();
  return BLOCKED_MIME.has(mime);
}

export function checkEvidenceUpload(opts: {
  file: File;
  /** Current org storage used (bytes). */
  storageUsedBytes: number;
  /** Plan evidence allowance including storage packs (bytes). */
  evidenceBytesAllowance: number;
  /**
   * When true, block new uploads over allowance.
   * Existing files remain readable either way.
   */
  enforceQuota?: boolean;
}): EvidenceUploadCheck {
  const { file, storageUsedBytes, evidenceBytesAllowance, enforceQuota = true } =
    opts;

  if (isBlockedEvidenceFile(file)) {
    return {
      ok: false,
      reason: "malware",
      message:
        "This file type is blocked for security. Upload images, PDF, or short video instead.",
    };
  }

  if (!isAllowedEvidenceMime(file.type) && !file.type) {
    // Allow empty MIME when extension looks like an image (HEIC from some browsers)
    const ext = getExtension(file.name);
    if (!["jpg", "jpeg", "png", "heic", "heif", "webp", "pdf", "mp4", "mov", "webm"].includes(ext)) {
      return {
        ok: false,
        reason: "type",
        message:
          "This file type is not allowed for evidence. Use images, PDF, or short video.",
      };
    }
  } else if (file.type && !isAllowedEvidenceMime(file.type)) {
    return {
      ok: false,
      reason: "type",
      message:
        "This file type is not allowed for evidence. Use images, PDF, or short video.",
    };
  }

  const maxBytes = maxBytesForFile(file);
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return {
      ok: false,
      reason: "size",
      message: `File is too large (max ${mb} MB for this type). Compress or resize before uploading.`,
    };
  }

  if (
    enforceQuota &&
    evidenceBytesAllowance > 0 &&
    storageUsedBytes + file.size > evidenceBytesAllowance
  ) {
    return {
      ok: false,
      reason: "quota",
      message:
        "Evidence storage allowance reached. Existing files remain available — add a storage pack or free space to upload more.",
    };
  }

  return { ok: true };
}

/** Soft warn when approaching or over allowance (never blocks reads). */
export function evidenceQuotaWarning(
  storageUsedBytes: number,
  evidenceBytesAllowance: number
): string | null {
  if (evidenceBytesAllowance <= 0) return null;
  const ratio = storageUsedBytes / evidenceBytesAllowance;
  if (ratio >= 1) {
    return "Evidence storage is at or over your plan allowance. Existing files stay readable — new uploads need a storage pack.";
  }
  if (ratio >= 0.85) {
    return "Evidence storage is nearly full. Consider a storage pack before large uploads.";
  }
  return null;
}

export function formatEvidenceBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
