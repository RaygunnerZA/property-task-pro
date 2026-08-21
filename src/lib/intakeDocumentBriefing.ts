import { mapIntakeDocumentType, normalizeIntakeExpiryDate } from "@/lib/mapIntakeDocumentType";
import type { IntakeSourceArtifact } from "@/types/intake-item";

export type IntakeDocOutcome =
  | "unsatisfactory"
  | "satisfactory"
  | "expired"
  | "valid"
  | "unknown";

export type IntakeReadProvenance = "document" | "filename" | "none";

export interface IntakeDocumentBriefing {
  title: string;
  documentType: string | null;
  outcome: IntakeDocOutcome;
  expiryDate: string | null;
  summary: string;
  findings: string[];
  excerpt: string;
  provenance: IntakeReadProvenance;
  needsFollowUp: boolean;
  fileKindLabel: string;
}

const OUTCOME_LABEL: Record<IntakeDocOutcome, string> = {
  unsatisfactory: "Unsatisfactory",
  satisfactory: "Satisfactory",
  expired: "Expired",
  valid: "Valid",
  unknown: "Not stated",
};

export function intakeOutcomeLabel(outcome: IntakeDocOutcome): string {
  return OUTCOME_LABEL[outcome];
}

export function humanizeIntakeFileStem(fileName: string | null | undefined): string {
  const stem = (fileName || "").replace(/\.[^.]+$/, "");
  const withoutIndex = stem.replace(/^\d+[_\-\s.]+/, "");
  const cleaned = withoutIndex
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return stem.replace(/[_-]+/g, " ").trim() || "Upload";
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function inferOutcomeFromText(text: string): IntakeDocOutcome {
  const value = text.toLowerCase().replace(/[_./\\-]+/g, " ");
  if (/\bunsatisfactory\b|\bfail(?:ed|ure)?\b|\bc1\b|\bc2\b/.test(value)) return "unsatisfactory";
  if (/\bexpired\b|\bpast due\b/.test(value)) return "expired";
  if (/\bsatisfactory\b|\bpass(?:ed)?\b/.test(value)) return "satisfactory";
  if (/\bvalid\b|\bin date\b/.test(value)) return "valid";
  return "unknown";
}

function inferTypeFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^(other|misc|uncertain|document|upload)$/i.test(trimmed)) return null;
  if (trimmed.length <= 80) {
    const mapped = mapIntakeDocumentType(trimmed);
    if (mapped && !/^(other|misc)$/i.test(mapped.type)) return mapped.type;
  }
  const value = text.toLowerCase();
  if (/\beicr\b|electrical(?:\s+installation)?\s+condition/.test(value)) return "EICR";
  if (/\bgas\s*safe|gas safety/.test(value)) return "Gas Safety Certificate";
  if (/\bpat\b|portable appliance/.test(value)) return "PAT Test";
  if (/\bfire\s+risk/.test(value)) return "Fire Risk Assessment";
  if (/\bfire\b/.test(value) && /\bcertificate\b/.test(value)) return "Fire Certificate";
  if (/\binvoice\b|\breceipt\b|\bquote\b/.test(value)) return "Invoice";
  return null;
}

function fileKindLabel(mimeType: string, fileName: string | null): string {
  const mime = mimeType.toLowerCase();
  const name = (fileName || "").toLowerCase();
  if (mime.startsWith("image/")) return "Photo";
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (mime.includes("word") || name.endsWith(".docx") || name.endsWith(".doc")) return "Word document";
  if (mime.includes("sheet") || mime.includes("excel") || name.endsWith(".xlsx")) return "Spreadsheet";
  if (mime.includes("text")) return "Text";
  return "Document";
}

function extractedRecord(artifact: IntakeSourceArtifact): Record<string, unknown> {
  return artifact.aiExtracted ?? {};
}

function titleFromStem(fileName: string | null): string {
  const human = humanizeIntakeFileStem(fileName);
  return human
    .replace(/\b(unsatisfactory|satisfactory|failed|fail|pass|passed|expired)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || human;
}

export function buildIntakeDocumentBriefing(
  artifact: IntakeSourceArtifact,
  officeText?: string | null
): IntakeDocumentBriefing {
  const extracted = extractedRecord(artifact);
  const metadata = (extracted.metadata as Record<string, unknown> | undefined) ?? {};
  const isStub = metadata.stub === true;
  const ocr = String(extracted.ocr_text || artifact.rawText || officeText || "").trim();
  const combined = [artifact.fileName, artifact.aiClassification, extracted.document_type, extracted.title, ocr]
    .filter(Boolean)
    .join("\n");

  const documentType =
    inferTypeFromText(String(extracted.document_type || artifact.aiClassification || "")) ||
    inferTypeFromText(combined);

  const outcomeFromAi = inferOutcomeFromText(String(extracted.outcome || extracted.status || ""));
  const outcome =
    outcomeFromAi !== "unknown" ? outcomeFromAi : inferOutcomeFromText(combined);

  const expiryDate = normalizeIntakeExpiryDate(
    (extracted.expiry_date as string | undefined) || (extracted.expiry_date_hint as string | undefined)
  );

  const aiTitle = String(extracted.title || "").trim();
  const title =
    (aiTitle && !isStub && !/^[0-9]+[_\-]/.test(aiTitle) ? aiTitle : "") ||
    titleFromStem(artifact.fileName);

  const findings = Array.isArray(extracted.findings)
    ? (extracted.findings as unknown[]).map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
    : [];

  const provenance: IntakeReadProvenance = ocr.length >= 40 && !isStub ? "document" : ocr.length >= 40 ? "document" : artifact.fileName ? "filename" : "none";

  // If we extracted office text locally, that is a real document read even when AI stubbed.
  const effectiveProvenance: IntakeReadProvenance =
    (officeText && officeText.trim().length >= 40) || (ocr.length >= 40 && !isStub)
      ? "document"
      : provenance;

  const excerpt = (officeText?.trim() || ocr).slice(0, 900);

  const typeLabel = documentType || "property document";
  const outcomeSentence =
    outcome === "unsatisfactory"
      ? `The outcome is unsatisfactory — this usually needs remedial work as well as filing.`
      : outcome === "satisfactory"
        ? `The outcome is satisfactory.`
        : outcome === "expired"
          ? `This looks expired or out of date.`
          : "";

  const summaryFromAi = String(extracted.summary || "").trim();
  const summary =
    summaryFromAi && !isStub
      ? summaryFromAi
      : [`This is a ${typeLabel}.`, outcomeSentence].filter(Boolean).join(" ");

  return {
    title,
    documentType,
    outcome,
    expiryDate,
    summary,
    findings,
    excerpt,
    provenance: effectiveProvenance,
    needsFollowUp: outcome === "unsatisfactory" || outcome === "expired",
    fileKindLabel: fileKindLabel(artifact.mimeType, artifact.fileName),
  };
}

export function intakeReadFromLabel(provenance: IntakeReadProvenance): string {
  if (provenance === "document") return "Document text";
  if (provenance === "filename") return "File name";
  return "Not enough to read";
}

function artifactFromIntakeItem(item: {
  id: string;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  raw_text: string | null;
  source_type?: IntakeSourceArtifact["sourceType"];
  ai_classification: string | null;
  ai_extracted: Record<string, unknown> | null;
  error_message?: string | null;
  status?: string;
}): IntakeSourceArtifact {
  return {
    intakeItemId: item.id,
    storagePath: item.storage_path,
    fileName: item.file_name,
    mimeType: item.mime_type || "application/octet-stream",
    rawText: item.raw_text,
    sourceType: item.source_type,
    aiClassification: item.ai_classification,
    aiExtracted: item.ai_extracted,
  };
}

function titleLooksLikeJunk(title: string): boolean {
  const letters = title.replace(/[^a-zA-Z]/g, "");
  return letters.length < 3;
}

/** One-line preview for pending-review rows — always includes a document insight. */
export function intakeInboxCardCopy(item: {
  id: string;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  raw_text: string | null;
  source_type?: IntakeSourceArtifact["sourceType"];
  ai_classification: string | null;
  ai_extracted: Record<string, unknown> | null;
  error_message?: string | null;
  status?: string;
}): { title: string; insight: string } {
  const briefing = buildIntakeDocumentBriefing(artifactFromIntakeItem(item));
  const title = titleLooksLikeJunk(briefing.title) ? briefing.fileKindLabel : briefing.title;

  if (item.status === "pending" || item.status === "processing") {
    return { title, insight: "Reading document…" };
  }
  if (item.status === "failed") {
    return { title, insight: item.error_message?.trim() || "Couldn’t read this file" };
  }

  if (briefing.outcome !== "unknown") {
    return {
      title,
      insight: briefing.documentType
        ? `${intakeOutcomeLabel(briefing.outcome)} · ${briefing.documentType}`
        : intakeOutcomeLabel(briefing.outcome),
    };
  }
  if (briefing.expiryDate) {
    const expiry = new Date(`${briefing.expiryDate}T00:00:00`);
    const expiryLabel = Number.isNaN(expiry.getTime())
      ? briefing.expiryDate
      : expiry.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    return { title, insight: `Expires ${expiryLabel}` };
  }
  if (briefing.documentType) {
    return { title, insight: briefing.documentType };
  }
  if (briefing.findings[0]) {
    return { title, insight: briefing.findings[0] };
  }
  if (briefing.fileKindLabel === "Photo") {
    return { title, insight: "Photo — no certificate details found" };
  }
  return { title, insight: "Open to confirm what to file" };
}
