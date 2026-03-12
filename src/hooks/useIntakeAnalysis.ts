/**
 * useIntakeAnalysis — Lightweight first-pass intake analysis for the universal intake modal.
 * Derives workflow hint (task | compliance | document | uncertain) and optional hints from
 * uploaded content and/or composed text. Does not overwrite user input; suggestions only.
 *
 * Model/economy: cheap, fast path. Deeper extraction only after user confirms path.
 */

import { useMemo } from "react";
import type { TempImage } from "@/types/temp-image";
import type { ImageAnalysisResult } from "@/types/temp-image";

export type WorkflowHint = "task" | "compliance" | "document" | "uncertain";

export interface IntakeAnalysisResult {
  workflow_hint: WorkflowHint;
  workflow_confidence: number;
  task_title_hint: string | null;
  document_type_hint: string | null;
  expiry_date_hint: string | null;
  labels: string[];
  ocr_text: string;
}

export interface UseIntakeAnalysisOptions {
  /** Processed images (with rawAnalysis if analysed) */
  images: TempImage[];
  /** Non-image files (e.g. PDFs) - for v1 we only use presence for "has upload" */
  fileCount: number;
  /** User-composed text (never written to by this hook) */
  composedText: string;
  /** If user has materially started composing (e.g. > N chars), don't over-commit on weak evidence */
  userHasComposed: boolean;
}

const COMPLIANCE_KEYWORDS =
  /certificate|safety|inspection|expiry|compliance|gas safe|epc|fire extinguisher|pat test|electrical|eicr|renewal/i;

function deriveWorkflow(
  images: TempImage[],
  fileCount: number,
  composedText: string,
  userHasComposed: boolean
): { hint: WorkflowHint; confidence: number; documentType: string | null; expiryDate: string | null } {
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
  const suggestedType = (metadata?.normalized_document_type as string) || docClass?.type;
  const suggestedExpiry = docClass?.expiry_date;
  const routerHint = metadata?.workflow_hint as WorkflowHint | undefined;
  const routerConfidenceRaw = Number(metadata?.workflow_confidence ?? 0);
  const routerConfidence = Number.isFinite(routerConfidenceRaw)
    ? Math.max(0, Math.min(1, routerConfidenceRaw))
    : 0;

  const detectedObjects = images.flatMap((img) => img.rawAnalysis?.detected_objects || []);
  const hasExpiry = detectedObjects.some((o) => o.expiry_date);
  const expiryFromObject = detectedObjects.find((o) => o.expiry_date)?.expiry_date;

  const labels = images.flatMap((i) => i.detectedLabels || []);
  const labelText = labels.join(" ").toLowerCase();
  const filenameLooksCompliance = COMPLIANCE_KEYWORDS.test(fileNameText);
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

  const looksCompliance =
    hasExpiry ||
    !!suggestedType ||
    filenameLooksCompliance ||
    COMPLIANCE_KEYWORDS.test(combinedText) ||
    COMPLIANCE_KEYWORDS.test(labelText);

  const looksTask =
    !looksCompliance &&
    (/\b(task|fix|repair|replace|install|check|inspect)\b/i.test(combinedText) ||
      combinedText.length > 20);

  if (routerHint && routerHint !== "uncertain" && routerConfidence >= 0.72) {
    return {
      hint: routerHint,
      confidence: routerConfidence,
      documentType: suggestedType || filenameTypeHint || null,
      expiryDate: suggestedExpiry || expiryFromObject || null,
    };
  }

  if (looksCompliance && (hasUpload || suggestedType)) {
    const confidence = suggestedType || hasExpiry ? 0.85 : filenameLooksCompliance ? 0.75 : 0.6;
    return {
      hint: "compliance",
      confidence: userHasComposed && !COMPLIANCE_KEYWORDS.test(text) ? Math.min(confidence, 0.7) : confidence,
      documentType: suggestedType || filenameTypeHint || null,
      expiryDate: suggestedExpiry || expiryFromObject || null,
    };
  }

  if (looksTask && combinedText.length >= 5) {
    return {
      hint: "task",
      confidence: 0.7,
      documentType: null,
      expiryDate: null,
    };
  }

  if (hasUpload && !looksCompliance && !looksTask) {
    return {
      hint: "document",
      confidence: 0.5,
      documentType: null,
      expiryDate: null,
    };
  }

  return {
    hint: "uncertain",
    confidence: 0.3,
    documentType: null,
    expiryDate: null,
  };
}

export function useIntakeAnalysis({
  images,
  fileCount,
  composedText,
  userHasComposed,
}: UseIntakeAnalysisOptions): IntakeAnalysisResult {
  return useMemo(() => {
    const ocrText = images.map((i) => i.aiOcrText || "").filter(Boolean).join("\n");
    const labels = Array.from(new Set(images.flatMap((i) => i.detectedLabels || [])));

    const { hint, confidence, documentType, expiryDate } = deriveWorkflow(
      images,
      fileCount,
      composedText,
      userHasComposed
    );

    const task_title_hint =
      composedText.trim().length >= 5 ? composedText.trim().slice(0, 60) : null;

    return {
      workflow_hint: hint,
      workflow_confidence: confidence,
      task_title_hint,
      document_type_hint: documentType,
      expiry_date_hint: expiryDate,
      labels,
      ocr_text: ocrText,
    };
  }, [images, fileCount, composedText, userHasComposed]);
}
