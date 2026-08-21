import { isMeaningfulSuggestedType } from "@/lib/intakeWorkflowSignals";

/** Preset values in the Add Record document-type select (excluding Other). */
export const INTAKE_COMPLIANCE_PRESETS = [
  "Fire Certificate",
  "Gas Safety Certificate",
  "Electrical Certificate",
  "EICR",
  "PAT Test",
] as const;

const ALIASES: Record<string, (typeof INTAKE_COMPLIANCE_PRESETS)[number]> = {
  "fire certificate": "Fire Certificate",
  "fire safety certificate": "Fire Certificate",
  "fire safety": "Fire Certificate",
  "gas safety certificate": "Gas Safety Certificate",
  "gas safety": "Gas Safety Certificate",
  "gas safe": "Gas Safety Certificate",
  cp12: "Gas Safety Certificate",
  "electrical certificate": "Electrical Certificate",
  eic: "Electrical Certificate",
  "electrical installation certificate": "Electrical Certificate",
  eicr: "EICR",
  "electrical installation condition report": "EICR",
  "pat test": "PAT Test",
  pat: "PAT Test",
  "portable appliance test": "PAT Test",
};

export function isIntakeCompliancePreset(type: string): boolean {
  return (INTAKE_COMPLIANCE_PRESETS as readonly string[]).includes(type);
}

/**
 * Map an AI / filename type onto Add Record presets.
 * Unknown but meaningful types stay as custom "Other" text so the user can edit.
 * Returns null when the model gave nothing usable — never invent a type.
 */
export function mapIntakeDocumentType(raw?: string | null): {
  type: string;
  isOther: boolean;
} | null {
  if (!isMeaningfulSuggestedType(raw)) return null;
  const trimmed = raw!.trim();
  const key = trimmed.toLowerCase();

  const alias = ALIASES[key];
  if (alias) return { type: alias, isOther: false };

  const exact = INTAKE_COMPLIANCE_PRESETS.find((preset) => preset.toLowerCase() === key);
  if (exact) return { type: exact, isOther: false };

  const partial = INTAKE_COMPLIANCE_PRESETS.find((preset) => {
    const p = preset.toLowerCase();
    return key.includes(p) || p.includes(key);
  });
  if (partial && key.length >= 3) return { type: partial, isOther: false };

  return { type: trimmed.slice(0, 80), isOther: true };
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function expandYear(raw: string): number {
  if (raw.length === 4) return Number(raw);
  const n = Number(raw);
  return n >= 90 ? 1900 + n : 2000 + n;
}

function isoIfRealCalendar(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1990 || year > 2100) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Normalise a date that was actually written (model/OCR). Never invent.
 * UK day-first for numeric dates; swap only when that reading is impossible.
 */
export function normalizeIntakeExpiryDate(raw?: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!value) return null;

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return isoIfRealCalendar(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = value.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = expandYear(numeric[3]);
    const uk = isoIfRealCalendar(year, second, first);
    if (uk) return uk;
    return isoIfRealCalendar(year, first, second);
  }

  const dayMonthYear = value.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (dayMonthYear) {
    const month = MONTHS[dayMonthYear[2].toLowerCase()];
    if (month) return isoIfRealCalendar(expandYear(dayMonthYear[3]), month, Number(dayMonthYear[1]));
  }

  const monthDayYear = value.match(/^([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{2,4})$/);
  if (monthDayYear) {
    const month = MONTHS[monthDayYear[1].toLowerCase()];
    if (month) return isoIfRealCalendar(expandYear(monthDayYear[3]), month, Number(monthDayYear[2]));
  }

  return null;
}

const EXPIRY_LABEL =
  /(?:next\s+service\s+due|next\s+(?:due|test|service|inspection|visit)|valid\s+until|expiry|expires|expiration|renew(?:al|ed)?(?:\s+by)?|due\s+date|\bdue\b|reinspect)/i;

const DATE_CAPTURE =
  /(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/;

/**
 * Pull a next-due / expiry date from OCR. Requires a nearby label so a random
 * table cell is not treated as expiry.
 */
export function inferExpiryFromOcrText(text?: string | null): string | null {
  if (!text) return null;
  const value = text.replace(/\u0000/g, " ");
  const labeled = new RegExp(`${EXPIRY_LABEL.source}[\\s\\S]{0,80}?${DATE_CAPTURE.source}`, "i");
  const match = value.match(labeled);
  if (!match?.[1]) return null;
  return normalizeIntakeExpiryDate(match[1]);
}

export type ImageAnalysisLike = {
  ocr_text?: string;
  detected_objects?: Array<{ expiry_date?: string }>;
  document_classification?: { type?: string; expiry_date?: string };
  metadata?: Record<string, unknown>;
};

/**
 * Read type/expiry from every field the analyser actually returns.
 * The edge function puts classification at the top level and copies the date to
 * metadata.normalized_expiry — not only metadata.document_classification.
 */
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
  const rawExpiry =
    nested?.expiry_date ||
    top?.expiry_date ||
    (typeof meta.normalized_expiry === "string" ? meta.normalized_expiry : null) ||
    result.detected_objects?.find((obj) => obj.expiry_date)?.expiry_date;
  const ocr =
    result.ocr_text || (typeof meta.raw_ocr === "string" ? meta.raw_ocr : "");
  return {
    documentType: mapped?.type ?? (isMeaningfulSuggestedType(rawType) ? rawType!.trim() : null),
    expiryDate: normalizeIntakeExpiryDate(rawExpiry) || inferExpiryFromOcrText(ocr),
  };
}

export function sanitizeScanTitle(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 3) return null;
  return cleaned.slice(0, 120);
}
