/** Filename / light-text fallback when full document AI is skipped or unavailable. */

const DATE_CAPTURE =
  /(\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/;

const EXPIRY_LABEL =
  /(?:next\s+service\s+due|next\s+safety\s+check|next\s+(?:check|due|test|service|inspection|visit)|(?:date\s+of\s+)?next\s+(?:check|inspection|service)|certificate\s+(?:is\s+)?valid\s+until|valid\s+until|expiry|expires|expiration|renew(?:al|ed)?(?:\s+by)?)/i;

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

function expandYear(raw: string): number {
  const n = Number(raw);
  if (raw.length <= 2) return n >= 70 ? 1900 + n : 2000 + n;
  return n;
}

function isoIfRealCalendar(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1990 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function normalizeStubDate(raw?: string | null): string | null {
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
    return isoIfRealCalendar(year, second, first) || isoIfRealCalendar(year, first, second);
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

/** Best-effort renewal date from OCR when AI is stubbed — never invent. */
function inferExpiryFromOcr(text?: string | null): string | null {
  if (!text?.trim()) return null;
  const labeled = new RegExp(`${EXPIRY_LABEL.source}[\\s\\S]{0,80}?${DATE_CAPTURE.source}`, "i");
  const match = text.replace(/\u0000/g, " ").match(labeled);
  if (!match?.[1]) return null;
  return normalizeStubDate(match[1]);
}

export function humanizeIntakeFileStem(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const withoutIndex = stem.replace(/^\d+[_\-\s.]+/, "");
  const cleaned = withoutIndex.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return stem.replace(/[_-]+/g, " ").trim() || "Upload";
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function inferDocTypeFromFilename(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.includes("eicr") || lower.includes("electrical")) return "EICR";
  if (lower.includes("epc") || lower.includes("energy performance")) return "EPC";
  if (lower.includes("gas")) return "Gas Safety Certificate";
  if (lower.includes("fire") && lower.includes("risk")) return "Fire Risk Assessment";
  if (lower.includes("fire")) return "Fire Certificate";
  if (lower.includes("pat")) return "PAT Test";
  if (lower.includes("legionella")) return "Legionella Risk Assessment";
  if (lower.includes("asbestos")) return "Asbestos Register";
  return null;
}

function inferOutcomeFromFilename(fileName: string): string | null {
  const lower = fileName.toLowerCase().replace(/[_./\\-]+/g, " ");
  if (/\bunsatisfactory\b|\bfail(?:ed|ure)?\b/.test(lower)) return "unsatisfactory";
  if (/\bexpired\b/.test(lower)) return "expired";
  if (/\bsatisfactory\b|\bpass(?:ed)?\b/.test(lower)) return "satisfactory";
  if (/\bvalid\b/.test(lower)) return "valid";
  return null;
}

function inferCategoryFromFilename(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (lower.includes("epc") || lower.includes("energy")) return "Misc";
  if (lower.includes("plan") || lower.includes("drawing")) return "Plans";
  if (lower.includes("lease") || lower.includes("contract") || lower.includes("legal")) return "Legal";
  if (lower.includes("fire") || lower.includes("safety")) return "Fire Safety";
  if (lower.includes("electrical") || lower.includes("eic")) return "Electrical";
  if (lower.includes("gas") || lower.includes("hvac")) return "Mechanical";
  if (lower.includes("water") || lower.includes("plumb") || lower.includes("legionella")) return "Water";
  if (lower.includes("insurance")) return "Insurance";
  return "Misc";
}

export function buildIntakeDocStub(
  fileName: string,
  ocrText?: string | null
): Record<string, unknown> {
  const title =
    humanizeIntakeFileStem(fileName)
      .replace(/\b(unsatisfactory|satisfactory|failed|fail|pass|passed|expired|valid)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim() || humanizeIntakeFileStem(fileName);
  const document_type = inferDocTypeFromFilename(fileName);
  const outcome = inferOutcomeFromFilename(`${fileName} ${ocrText || ""}`);
  const expiry_date = inferExpiryFromOcr(ocrText);
  const summary = [
    document_type ? `This is a ${document_type}.` : "This looks like a property document.",
    outcome === "unsatisfactory"
      ? "The outcome is unsatisfactory — file the record and consider follow-up work."
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title,
    document_type,
    category: inferCategoryFromFilename(fileName),
    expiry_date,
    renewal_frequency: null,
    confidence: ocrText ? 0.55 : 0.35,
    ocr_text: ocrText?.slice(0, 2000) || null,
    summary,
    outcome,
    findings: [],
    important_dates: expiry_date
      ? [{ label: "Expiry / renewal", date: expiry_date, kind: "expiry" }]
      : [],
    detected_spaces: [],
    detected_assets: [],
    compliance_recommendations: [],
    hazards: [],
    metadata: { stub: true, source: ocrText ? "document_text" : "filename" },
  };
}

export function isUsableDocAnalysis(result: Record<string, unknown>): boolean {
  if (result.ok === false || result.skipped === true) return false;
  if (typeof result.error === "string" && result.error.length > 0) return false;
  return Boolean(
    result.document_type ||
      result.expiry_date ||
      (typeof result.ocr_text === "string" && result.ocr_text.trim().length >= 40) ||
      (typeof result.summary === "string" && result.summary.trim().length >= 12)
  );
}
