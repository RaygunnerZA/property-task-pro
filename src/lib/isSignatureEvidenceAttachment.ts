/**
 * Checklist signature captures are evidence for a step, not task gallery photos.
 * They stay on the subtask (View evidence) and must not become the task thumbnail.
 */

export type AttachmentLike = {
  file_name?: string | null;
  file_type?: string | null;
  metadata?: unknown;
};

function metadataEvidenceKind(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const kind = (metadata as Record<string, unknown>).evidence_kind;
  return typeof kind === "string" ? kind.toLowerCase() : null;
}

export function isSignatureEvidenceAttachment(attachment: AttachmentLike | null | undefined): boolean {
  if (!attachment) return false;
  if (metadataEvidenceKind(attachment.metadata) === "signature") return true;
  const fileName = String(attachment.file_name || "").toLowerCase();
  return fileName === "signature.png" || fileName.startsWith("signature.");
}
