/**
 * useIntakeAnalysis — Lightweight first-pass intake analysis for the universal intake modal.
 * Derives workflow hint (task | compliance | document | uncertain) and optional hints from
 * uploaded content and/or composed text. Does not overwrite user input; suggestions only.
 */

import { useMemo } from "react";
import type { TempImage } from "@/types/temp-image";
import type { IntakeMode } from "@/types/intake";
import {
  isMeaningfulSuggestedType,
  textHasIssueSignals,
  textHasComplianceDocumentSignals,
  labelsSuggestComplianceDocument,
} from "@/lib/intakeWorkflowSignals";

export type WorkflowHint = "task" | "compliance" | "document" | "uncertain";

export interface IntakeAnalysisResult {
  workflow_hint: WorkflowHint;
  workflow_confidence: number;
  task_title_hint: string | null;
  document_type_hint: string | null;
  expiry_date_hint: string | null;
  labels: string[];
  ocr_text: string;
  /** True when upload looks like a certificate/record (not equipment-only). */
  has_strong_document_evidence: boolean;
  /** True when leak/damage/fault language appears in text, OCR, or labels. */
  has_issue_signals: boolean;
}

export interface UseIntakeAnalysisOptions {
  images: TempImage[];
  fileCount: number;
  composedText: string;
  userHasComposed: boolean;
  /** User-selected tab — intent wins over weak AI classification. */
  intakeMode?: IntakeMode;
}

type DeriveResult = {
  hint: WorkflowHint;
  confidence: number;
  documentType: string | null;
  expiryDate: string | null;
  hasStrongDocumentEvidence: boolean;
  hasIssueSignals: boolean;
};

/** Exported for unit tests. */
export function deriveIntakeWorkflow(
  images: TempImage[],
  fileCount: number,
  composedText: string,
  userHasComposed: boolean,
  intakeMode: IntakeMode
): DeriveResult {
  const text = composedText.trim().toLowerCase();
  const hasUpload = images.length > 0 || fileCount > 0;
  const ocrParts = images.map((i) => i.aiOcrText || "").filter(Boolean);
  const fileNameText = images
    .map((i) => i.display_name || "")
    .join(" ")
    .replace(/[_\-\.]/g, " ")
    .toLowerCase();
  const combinedText = [composedText, ...ocrParts, fileNameText].join("\n").toLowerCase();

  const metadata = images[0]?.rawAnalysis?.metadata as Record<string, unknown> | undefined;
  const docClass = metadata?.document_classification as { type?: string; expiry_date?: string } | undefined;
  const rawSuggestedType = (metadata?.normalized_document_type as string) || docClass?.type;
  const suggestedType = isMeaningfulSuggestedType(rawSuggestedType) ? rawSuggestedType!.trim() : null;
  const suggestedExpiry = docClass?.expiry_date;
  const routerOnlyPass = metadata?.router_mode === true;
  const routerHint = metadata?.workflow_hint as WorkflowHint | undefined;
  const routerConfidenceRaw = Number(metadata?.workflow_confidence ?? 0);
  const routerConfidence = Number.isFinite(routerConfidenceRaw)
    ? Math.max(0, Math.min(1, routerConfidenceRaw))
    : 0;
  const routerTaskTitle =
    typeof metadata?.task_title_hint === "string" ? metadata.task_title_hint : "";

  const detectedObjects = images.flatMap((img) => img.rawAnalysis?.detected_objects || []);
  const hasExpiry = detectedObjects.some((o) => o.expiry_date);
  const expiryFromObject = detectedObjects.find((o) => o.expiry_date)?.expiry_date;
  const anomalyText = images
    .flatMap((img) => img.rawAnalysis?.anomalies ?? [])
    .map((a) => String(a))
    .join(" ");

  const labels = images.flatMap((i) => i.detectedLabels || []);
  const labelText = labels.join(" ").toLowerCase();

  const filenameLooksCompliance = textHasComplianceDocumentSignals(fileNameText);

  const filenameTypeHint = (() => {
    if (/\beicr\b/i.test(fileNameText)) return "EICR";
    if (/\bepc\b/i.test(fileNameText)) return "EPC";
    if (/\bpat\b/i.test(fileNameText)) return "PAT Test";
    if (/\bgas\b.*\bsafety\b/i.test(fileNameText) || /\bgas\s*safe\b/i.test(fileNameText)) {
      return "Gas Safety Certificate";
    }
    if (/\bfire\b.*\bcertificate\b/i.test(fileNameText)) return "Fire Certificate";
    if (/\belectrical\b.*\bcertificate\b/i.test(fileNameText)) return "Electrical Certificate";
    if (/\bcertificate\b|\binspection\b/i.test(fileNameText)) return "Safety Certificate";
    return null;
  })();

  const hasStrongDocumentEvidence = Boolean(
    hasExpiry ||
      suggestedType ||
      filenameLooksCompliance ||
      textHasComplianceDocumentSignals(combinedText) ||
      labelsSuggestComplianceDocument(labelText)
  );

  const hasIssueSignals = Boolean(
    textHasIssueSignals(combinedText) ||
      textHasIssueSignals(labelText) ||
      textHasIssueSignals(anomalyText) ||
      textHasIssueSignals(routerTaskTitle)
  );

  const preferReportIssue = intakeMode === "report_issue";

  if (hasIssueSignals && (preferReportIssue || hasUpload)) {
    const issueConfidence = userHasComposed ? 0.82 : 0.78;
    return {
      hint: "task",
      confidence: issueConfidence,
      documentType: null,
      expiryDate: null,
      hasStrongDocumentEvidence,
      hasIssueSignals: true,
    };
  }

  if (
    !routerOnlyPass &&
    routerHint &&
    routerHint !== "uncertain" &&
    routerConfidence >= 0.72
  ) {
    if (preferReportIssue && (routerHint === "compliance" || routerHint === "document")) {
      if (!hasStrongDocumentEvidence || routerConfidence < 0.8) {
        return {
          hint: hasUpload ? "uncertain" : "task",
          confidence: 0.45,
          documentType: suggestedType || filenameTypeHint || null,
          expiryDate: suggestedExpiry || expiryFromObject || null,
          hasStrongDocumentEvidence,
          hasIssueSignals,
        };
      }
    }
    if (!preferReportIssue && routerHint === "task" && !hasIssueSignals && hasStrongDocumentEvidence) {
      return {
        hint: "compliance",
        confidence: Math.max(routerConfidence, 0.75),
        documentType: suggestedType || filenameTypeHint || null,
        expiryDate: suggestedExpiry || expiryFromObject || null,
        hasStrongDocumentEvidence,
        hasIssueSignals,
      };
    }
    return {
      hint: routerHint,
      confidence: routerConfidence,
      documentType: suggestedType || filenameTypeHint || null,
      expiryDate: suggestedExpiry || expiryFromObject || null,
      hasStrongDocumentEvidence,
      hasIssueSignals,
    };
  }

  if (hasStrongDocumentEvidence && hasUpload) {
    let confidence = hasExpiry || suggestedType ? 0.88 : filenameLooksCompliance ? 0.82 : 0.75;
    if (userHasComposed && !textHasComplianceDocumentSignals(text)) {
      confidence = Math.min(confidence, 0.72);
    }
    if (preferReportIssue && confidence < 0.8) {
      return {
        hint: "uncertain",
        confidence: 0.4,
        documentType: suggestedType || filenameTypeHint || null,
        expiryDate: suggestedExpiry || expiryFromObject || null,
        hasStrongDocumentEvidence,
        hasIssueSignals,
      };
    }
    return {
      hint: "compliance",
      confidence,
      documentType: suggestedType || filenameTypeHint || null,
      expiryDate: suggestedExpiry || expiryFromObject || null,
      hasStrongDocumentEvidence,
      hasIssueSignals,
    };
  }

  const looksTaskFromText =
    /\b(task|fix|repair|replace|install)\b/i.test(combinedText) || combinedText.length > 20;

  if (looksTaskFromText && combinedText.length >= 5) {
    return {
      hint: "task",
      confidence: 0.7,
      documentType: null,
      expiryDate: null,
      hasStrongDocumentEvidence,
      hasIssueSignals,
    };
  }

  if (hasUpload) {
    if (preferReportIssue) {
      return {
        hint: "task",
        confidence: 0.55,
        documentType: null,
        expiryDate: null,
        hasStrongDocumentEvidence: false,
        hasIssueSignals,
      };
    }
    return {
      hint: "uncertain",
      confidence: 0.35,
      documentType: null,
      expiryDate: null,
      hasStrongDocumentEvidence: false,
      hasIssueSignals,
    };
  }

  return {
    hint: "uncertain",
    confidence: 0.3,
    documentType: null,
    expiryDate: null,
    hasStrongDocumentEvidence: false,
    hasIssueSignals,
  };
}

export function useIntakeAnalysis({
  images,
  fileCount,
  composedText,
  userHasComposed,
  intakeMode = "report_issue",
}: UseIntakeAnalysisOptions): IntakeAnalysisResult {
  return useMemo(() => {
    const ocrText = images.map((i) => i.aiOcrText || "").filter(Boolean).join("\n");
    const labels = Array.from(new Set(images.flatMap((i) => i.detectedLabels || [])));

    const derived = deriveIntakeWorkflow(images, fileCount, composedText, userHasComposed, intakeMode);

    const task_title_hint =
      composedText.trim().length >= 5
        ? composedText.trim().slice(0, 60)
        : derived.hasIssueSignals && ocrText.trim()
          ? ocrText.trim().slice(0, 60)
          : null;

    return {
      workflow_hint: derived.hint,
      workflow_confidence: derived.confidence,
      task_title_hint,
      document_type_hint: derived.documentType,
      expiry_date_hint: derived.expiryDate,
      labels,
      ocr_text: ocrText,
      has_strong_document_evidence: derived.hasStrongDocumentEvidence,
      has_issue_signals: derived.hasIssueSignals,
    };
  }, [images, fileCount, composedText, userHasComposed, intakeMode]);
}
