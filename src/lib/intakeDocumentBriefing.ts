import { mapIntakeDocumentType, naturalLanguageRecordTitle } from "@/lib/mapIntakeDocumentType";
import {
  interpretDocument,
  type DocumentUnderstanding,
} from "@/lib/intake/documentUnderstanding";
import type { IntakeSourceArtifact } from "@/types/intake-item";
import {
  inboundEmailOutcomeLabel,
  inboundEmailSenderLabel,
  readInboundEmailProposal,
} from "@/lib/intake/inboundEmailProposal";

export type IntakeDocOutcome =
  | "unsatisfactory"
  | "satisfactory"
  | "expired"
  | "valid"
  | "unknown";

export type IntakeReadProvenance = "document" | "filename" | "none";

/** Where the document type came from. A filename hit is not a document read. */
export type IntakeTypeEvidence = "document" | "inference" | "filename" | "none";

export interface IntakeDocumentBriefing {
  title: string;
  documentType: string | null;
  /** Type supported by document text, when any. Filename-only types stay out of this field. */
  contentType: string | null;
  typeEvidence: IntakeTypeEvidence;
  outcome: IntakeDocOutcome;
  expiryDate: string | null;
  summary: string;
  findings: string[];
  excerpt: string;
  provenance: IntakeReadProvenance;
  needsFollowUp: boolean;
  fileKindLabel: string;
  /** Document-level reading. Fields below are promoted only when this allows it. */
  understanding: DocumentUnderstanding;
}

export interface IntakeBriefingContext {
  propertyName?: string | null;
  propertyAddress?: string | null;
  asOf?: Date;
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

  const value = trimmed.toLowerCase().replace(/[_./\\-]+/g, " ");
  if (/\beicr\b|electrical(?:\s+installation)?\s+condition/.test(value)) return "EICR";
  if (/\bepc\b|energy performance/.test(value)) return "EPC";
  if (/\bgas\s*safe|gas safety/.test(value)) return "Gas Safety Certificate";
  if (/\bpat\b|portable appliance/.test(value)) return "PAT Test";
  if (/\bfire\s+risk/.test(value)) return "Fire Risk Assessment";
  if (/\bfire\b/.test(value) && /\bcertificate\b/.test(value)) return "Fire Certificate";
  if (/\binvoice\b|\breceipt\b|\bquote\b/.test(value)) return "Invoice";
  if (/\basbestos\b/.test(value) && /\bregister\b/.test(value)) return "Asbestos Management Survey";
  if (/\basbestos\b/.test(value) && /\b(survey|management|reinspection)\b/.test(value)) {
    return "Asbestos Management Survey";
  }

  if (
    trimmed.length <= 80 &&
    !/\n/.test(trimmed) &&
    !/\.[a-z0-9]{2,5}$/i.test(trimmed)
  ) {
    const mapped = mapIntakeDocumentType(trimmed);
    if (mapped && !mapped.isOther) return mapped.type;
  }

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

function isEmptyIntakeSummary(summary: string): boolean {
  return /^this is an?\s+(unclear|unknown|misc|other|uncertain|document)\.?$/i.test(summary.trim());
}

function titleFromStem(fileName: string | null): string {
  const human = humanizeIntakeFileStem(fileName);
  return human
    .replace(/\b(unsatisfactory|satisfactory|failed|fail|pass|passed|expired|valid)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || human;
}

export function buildIntakeDocumentBriefing(
  artifact: IntakeSourceArtifact,
  officeText?: string | null,
  context?: IntakeBriefingContext
): IntakeDocumentBriefing {
  const extracted = extractedRecord(artifact);
  const metadata = (extracted.metadata as Record<string, unknown> | undefined) ?? {};
  const isStub = metadata.stub === true;
  const ocr = String(extracted.ocr_text || artifact.rawText || officeText || "").trim();

  const rawType = String(extracted.document_type || artifact.aiClassification || "");
  const mappedType = mapIntakeDocumentType(rawType);
  const filenameStem = humanizeIntakeFileStem(artifact.fileName);
  const filenameMapped = mapIntakeDocumentType(filenameStem);
  const filenameType =
    inferTypeFromText(filenameStem) ||
    (filenameMapped && !filenameMapped.isOther ? filenameMapped.type : null);
  const bodyType =
    inferTypeFromText(ocr) ||
    (!isStub ? inferTypeFromText(rawType) : null) ||
    (!isStub && mappedType && !mappedType.isOther ? mappedType.type : null);
  const contentType = bodyType;
  const documentType = contentType || filenameType;
  const typeEvidence: IntakeTypeEvidence = contentType
    ? ocr.length >= 40
      ? "document"
      : "inference"
    : filenameType
      ? "filename"
      : "none";

  const understanding = interpretDocument({
    text: ocr,
    fileName: artifact.fileName,
    documentType,
    propertyName: context?.propertyName,
    propertyAddress: context?.propertyAddress,
    asOf: context?.asOf,
  });
  const outcome = ocr ? understanding.promotedOutcome : "unknown";
  const expiryDate = ocr ? understanding.promotedExpiry : null;

  const aiTitle = String(extracted.title || "").trim();
  const title =
    naturalLanguageRecordTitle(documentType) ||
    (aiTitle && !isStub && !/^[0-9]+[_\-]/.test(aiTitle) ? aiTitle : "") ||
    titleFromStem(artifact.fileName);

  const findings = Array.isArray(extracted.findings)
    ? (extracted.findings as unknown[])
        .map((item) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object" && "text" in item) {
            return String((item as { text: unknown }).text).trim();
          }
          return "";
        })
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const effectiveProvenance: IntakeReadProvenance =
    ocr.length >= 40 ? "document" : artifact.fileName ? "filename" : "none";

  const excerpt = (officeText?.trim() || ocr).slice(0, 900);

  const typeLabel = documentType || "property document";
  const article = /^(eicr|epc|[aeiou])/i.test(typeLabel) ? "an" : "a";
  const outcomeSentence =
    outcome === "unsatisfactory"
      ? `The outcome is unsatisfactory — this usually needs remedial work as well as filing.`
      : outcome === "satisfactory"
        ? `The outcome is satisfactory.`
        : outcome === "expired"
          ? `This looks expired or out of date.`
          : "";

  const summaryFromAi = String(extracted.summary || "").trim();
  const usableAiSummary =
    summaryFromAi && !isStub && !isEmptyIntakeSummary(summaryFromAi) ? summaryFromAi : "";
  const lead =
    typeEvidence === "document" && documentType
      ? `This is ${article} ${typeLabel}.`
      : typeEvidence === "inference" && documentType
        ? `This looks like ${article} ${typeLabel}.`
        : typeEvidence === "filename" && documentType
          ? `The file name looks like ${article} ${typeLabel}. The document has not confirmed that.`
          : "Filla couldn't tell what this is.";
  const summary =
    understanding.summary || usableAiSummary || [lead, outcomeSentence].filter(Boolean).join(" ");

  return {
    title,
    documentType,
    contentType,
    typeEvidence,
    outcome,
    expiryDate,
    summary,
    findings,
    excerpt,
    provenance: effectiveProvenance,
    needsFollowUp: outcome === "unsatisfactory" || outcome === "expired",
    fileKindLabel: fileKindLabel(artifact.mimeType, artifact.fileName),
    understanding,
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
  email_provenance?: unknown;
  error_message?: string | null;
  status?: string;
}, extractedText?: string | null): { title: string; insight: string } {
  const briefing = buildIntakeDocumentBriefing(artifactFromIntakeItem(item), extractedText);
  const title = titleLooksLikeJunk(briefing.title) ? briefing.fileKindLabel : briefing.title;

  if (item.status === "pending" || item.status === "processing") {
    return { title, insight: "Reading document…" };
  }
  if (item.status === "failed") {
    return { title, insight: item.error_message?.trim() || "Couldn’t read this file" };
  }

  const proposal = readInboundEmailProposal(item.ai_extracted);
  if (proposal) {
    const sender = inboundEmailSenderLabel(item.email_provenance);
    return {
      title: proposal.suggested_title || title,
      insight: [inboundEmailOutcomeLabel(proposal), sender].filter(Boolean).join(" · "),
    };
  }

  if (briefing.typeEvidence === "document" && briefing.understanding.statusLabel) {
    return {
      title,
      insight: briefing.documentType
        ? `${briefing.understanding.statusLabel} · ${briefing.documentType}`
        : briefing.understanding.statusLabel,
    };
  }
  if (briefing.typeEvidence === "document" && briefing.outcome !== "unknown") {
    return {
      title,
      insight: briefing.documentType
        ? `${intakeOutcomeLabel(briefing.outcome)} · ${briefing.documentType}`
        : intakeOutcomeLabel(briefing.outcome),
    };
  }
  if (briefing.typeEvidence === "inference" && briefing.contentType) {
    return { title, insight: `Looks like ${briefing.contentType}` };
  }
  if (briefing.typeEvidence === "filename" && briefing.documentType) {
    return { title, insight: `File name suggests ${briefing.documentType}` };
  }
  if (briefing.typeEvidence === "document" && briefing.expiryDate) {
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
