import type { IntakeMode } from "@/types/intake";
import type { IntakeSourceArtifact } from "@/types/intake-item";

const TASK_HINTS = new Set(["task"]);
const RECORD_HINTS = new Set(["compliance", "document"]);

const RECORD_DOC_TYPES = [
  "invoice",
  "certificate",
  "gas",
  "eicr",
  "electrical",
  "fire",
  "insurance",
  "lease",
  "legionella",
  "pat",
  "asbestos",
  "plan",
  "quote",
  "receipt",
  "contract",
  "manual",
  "inspection",
  "assessment",
];

function extractedRecord(item: IntakeSourceArtifact): Record<string, unknown> | null {
  return item.aiExtracted ?? null;
}

export function isImageMime(mime: string | null | undefined): boolean {
  return (mime || "").toLowerCase().startsWith("image/");
}

export function isPdfMime(mime: string | null | undefined, fileName?: string | null): boolean {
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf")) return true;
  return (fileName || "").toLowerCase().endsWith(".pdf");
}

export function isPreviewableDocument(
  mime: string | null | undefined,
  fileName?: string | null
): boolean {
  const m = (mime || "").toLowerCase();
  if (isImageMime(m) || isPdfMime(m, fileName)) return true;
  return m.includes("text/plain") || (fileName || "").toLowerCase().endsWith(".txt");
}

export function formatIntakeFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function intakeReviewClassification(
  artifact: IntakeSourceArtifact,
  fallbackFileName?: string
): string {
  const extracted = extractedRecord(artifact);
  const fromAi =
    artifact.aiClassification?.trim() ||
    (extracted?.document_type as string | undefined)?.trim() ||
    (extracted?.category as string | undefined)?.trim() ||
    (extracted?.document_type_hint as string | undefined)?.trim() ||
    (extracted?.title as string | undefined)?.trim();
  if (fromAi) return fromAi;
  if (fallbackFileName) {
    const base = fallbackFileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    return base || "Upload";
  }
  return "Upload";
}

export function intakeReviewSummaryText(artifact: IntakeSourceArtifact): string {
  if (artifact.rawText?.trim()) return artifact.rawText.trim().slice(0, 280);

  const extracted = extractedRecord(artifact);
  if (!extracted) return "";

  const ocr = (extracted.ocr_text as string | undefined)?.trim();
  if (ocr) return ocr.slice(0, 280);

  const title = (extracted.title as string | undefined)?.trim();
  if (title) return title;

  const labels = extracted.detected_labels as string[] | undefined;
  if (labels?.length) return labels.slice(0, 6).join(" · ");

  return "";
}

/** Best-guess filing destination from AI extraction + mime type. */
export function suggestIntakeMode(artifact: IntakeSourceArtifact): IntakeMode {
  const extracted = extractedRecord(artifact);
  const hint =
    (extracted?.workflow_hint as string | undefined) ||
    ((extracted?.metadata as Record<string, unknown> | undefined)?.workflow_hint as string | undefined);

  if (hint && TASK_HINTS.has(hint)) return "report_issue";
  if (hint && RECORD_HINTS.has(hint)) return "add_record";

  const docType = (
    (extracted?.document_type as string | undefined) ||
    (extracted?.document_type_hint as string | undefined) ||
    artifact.aiClassification ||
    ""
  ).toLowerCase();

  if (docType) {
    if (RECORD_DOC_TYPES.some((token) => docType.includes(token))) return "add_record";
    if (docType === "other" || docType === "uncertain") {
      // fall through to mime heuristics
    } else {
      return "add_record";
    }
  }

  const mime = artifact.mimeType.toLowerCase();
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("sheet") || mime.includes("text")) {
    return "add_record";
  }

  if (isImageMime(mime)) {
    const anomalies = extracted?.anomalies as unknown[] | undefined;
    const labels = (extracted?.detected_labels as string[] | undefined) ?? [];
    const damageWords = ["damage", "leak", "broken", "crack", "rust", "stain", "fault"];
    const labelText = labels.join(" ").toLowerCase();
    if (damageWords.some((w) => labelText.includes(w)) || (anomalies?.length ?? 0) > 0) {
      return "report_issue";
    }
    return "add_record";
  }

  return "add_record";
}

export function intakeReviewSuggestionLabel(mode: IntakeMode): string {
  return mode === "add_record" ? "Add to Records" : "Report an issue";
}

export function intakeReviewSuggestionReason(
  artifact: IntakeSourceArtifact,
  mode: IntakeMode
): string {
  const classification = intakeReviewClassification(artifact);
  if (mode === "add_record") {
    return `This looks like a ${classification.toLowerCase()} — file it as a property record.`;
  }
  return `This may need follow-up work — create a task to track it.`;
}
