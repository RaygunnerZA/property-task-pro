/**
 * Derive Add Record type / primary renewal date from image analysis output.
 * Prefer labelled important_dates over a misclassified classification.expiry_date.
 */

import {
  extractImportantDatesFromOcr,
  mergeImportantDates,
  normalizeImportantDates,
  primaryExpiryFromDates,
} from "@/lib/intakeDocumentDates";
import { isMeaningfulSuggestedType } from "@/lib/intakeWorkflowSignals";
import {
  mapIntakeDocumentType,
  normalizeIntakeExpiryDate,
  type ImageAnalysisLike,
} from "@/lib/mapIntakeDocumentType";

export type { ImageAnalysisLike };

export function hintsFromImageAnalysis(result?: ImageAnalysisLike | null): {
  documentType: string | null;
  expiryDate: string | null;
} {
  if (!result) return { documentType: null, expiryDate: null };
  const meta = result.metadata ?? {};
  const nested = meta.document_classification as { type?: string; expiry_date?: string } | undefined;
  const top = result.document_classification;
  const rawType =
    (typeof meta.normalized_document_type === "string" ? meta.normalized_document_type : null) ||
    nested?.type ||
    top?.type;
  const mapped = mapIntakeDocumentType(rawType);
  const documentType = mapped?.type ?? (isMeaningfulSuggestedType(rawType) ? rawType!.trim() : null);

  const ocr = result.ocr_text || (typeof meta.raw_ocr === "string" ? meta.raw_ocr : "");
  const fromOcr = extractImportantDatesFromOcr(ocr);
  const fromMeta = normalizeImportantDates(
    meta.important_dates ?? (result as { important_dates?: unknown }).important_dates
  );
  const merged = mergeImportantDates(fromMeta, fromOcr);
  const primaryFromDates = primaryExpiryFromDates(merged);
  if (primaryFromDates) {
    return { documentType, expiryDate: primaryFromDates };
  }

  const rawExpiry =
    nested?.expiry_date ||
    top?.expiry_date ||
    (typeof meta.normalized_expiry === "string" ? meta.normalized_expiry : null) ||
    result.detected_objects?.find((obj) => obj.expiry_date)?.expiry_date;

  const normalized = normalizeIntakeExpiryDate(rawExpiry);
  if (!normalized) {
    return { documentType, expiryDate: null };
  }

  // Classification claimed expiry, but OCR labelled that same day as
  // issued/collected/corrective-deadline/etc. — never promote a non-renewal.
  const isRenewalKind = (kind: string) => kind === "expiry" || kind === "next_due";
  const ocrHit = fromOcr.find((d) => d.date === normalized);
  if (ocrHit && !isRenewalKind(ocrHit.kind)) {
    return { documentType, expiryDate: null };
  }

  // If OCR found other labelled dates and none are renewal, do not promote a bare date.
  if (fromOcr.length > 0 && !fromOcr.some((d) => isRenewalKind(d.kind))) {
    return { documentType, expiryDate: null };
  }

  return { documentType, expiryDate: normalized };
}
