import { isMeaningfulSuggestedType } from "@/lib/intakeWorkflowSignals";

/**
 * Preset values in the Add Record document-type select (excluding Other).
 * Ordered by common property ops groups — fire → electrical → gas/mech →
 * water → asbestos → energy → building fabric.
 */
export const INTAKE_COMPLIANCE_PRESETS = [
  // Fire & life safety
  "Fire Certificate",
  "Fire Risk Assessment",
  "Fire Alarm Servicing",
  "Fire Extinguisher Service",
  "Fire Door Inspection",
  "Emergency Lighting Test",
  "Sprinkler System Servicing",
  "Smoke Vent Servicing",
  "Dry Riser Test",
  "Wet Riser Test",
  // Electrical
  "Electrical Certificate",
  "EICR",
  "PAT Test",
  "Lightning Protection Test",
  // Gas / mechanical
  "Gas Safety Certificate",
  "Boiler Service",
  "HVAC Servicing",
  "F-Gas Checks",
  "Air Conditioning Inspection",
  "Pressure Vessel Inspection",
  "Kitchen Extract Cleaning",
  // Lifts / access equipment
  "LOLER Inspection",
  "UPS Service",
  // Water hygiene
  "Legionella Risk Assessment",
  "Water Temperature Checks",
  "Tank Inspection",
  "Water Hygiene Certificate",
  // Asbestos
  "Asbestos Management Survey",
  "Asbestos Reinspection",
  // Energy & building
  "Energy Performance Certificate",
  "Accessibility Audit",
  "Building Insurance Policy",
  "Insurance Schedule",
  "Listed Building Consent Review",
] as const;

export type IntakeCompliancePreset = (typeof INTAKE_COMPLIANCE_PRESETS)[number];

const ALIASES: Record<string, IntakeCompliancePreset> = {
  // Fire
  "fire certificate": "Fire Certificate",
  "fire safety certificate": "Fire Certificate",
  "fire safety": "Fire Certificate",
  "fire risk assessment": "Fire Risk Assessment",
  fra: "Fire Risk Assessment",
  "fire alarm": "Fire Alarm Servicing",
  "fire alarm service": "Fire Alarm Servicing",
  "fire alarm servicing": "Fire Alarm Servicing",
  "fire extinguisher": "Fire Extinguisher Service",
  "fire extinguisher service": "Fire Extinguisher Service",
  "fire extinguisher certificate": "Fire Extinguisher Service",
  "fire door": "Fire Door Inspection",
  "fire door inspection": "Fire Door Inspection",
  "emergency lighting": "Emergency Lighting Test",
  "emergency lighting test": "Emergency Lighting Test",
  "emergency lights": "Emergency Lighting Test",
  sprinkler: "Sprinkler System Servicing",
  "sprinkler service": "Sprinkler System Servicing",
  "smoke vent": "Smoke Vent Servicing",
  "aov service": "Smoke Vent Servicing",
  "dry riser": "Dry Riser Test",
  "wet riser": "Wet Riser Test",
  // Electrical
  "electrical certificate": "Electrical Certificate",
  eic: "Electrical Certificate",
  "electrical installation certificate": "Electrical Certificate",
  "electrical installation condition report": "EICR",
  "pat test": "PAT Test",
  pat: "PAT Test",
  "pat testing": "PAT Test",
  "portable appliance test": "PAT Test",
  "portable appliance testing": "PAT Test",
  "lightning protection": "Lightning Protection Test",
  // Gas / mechanical
  "gas safety certificate": "Gas Safety Certificate",
  "gas safety": "Gas Safety Certificate",
  "gas safe": "Gas Safety Certificate",
  cp12: "Gas Safety Certificate",
  "boiler service": "Boiler Service",
  "boiler servicing": "Boiler Service",
  hvac: "HVAC Servicing",
  "hvac service": "HVAC Servicing",
  "hvac servicing": "HVAC Servicing",
  "f-gas": "F-Gas Checks",
  fgas: "F-Gas Checks",
  "f gas": "F-Gas Checks",
  tm44: "Air Conditioning Inspection",
  "air conditioning inspection": "Air Conditioning Inspection",
  "ac inspection": "Air Conditioning Inspection",
  "pressure vessel": "Pressure Vessel Inspection",
  "kitchen extract": "Kitchen Extract Cleaning",
  "canopy clean": "Kitchen Extract Cleaning",
  // Lifts
  loler: "LOLER Inspection",
  "lift inspection": "LOLER Inspection",
  "thorough examination": "LOLER Inspection",
  ups: "UPS Service",
  "ups service": "UPS Service",
  // Water
  legionella: "Legionella Risk Assessment",
  "legionella risk assessment": "Legionella Risk Assessment",
  "legionella l8 risk assessment": "Legionella Risk Assessment",
  l8: "Legionella Risk Assessment",
  "water temperature": "Water Temperature Checks",
  "monthly water temperature checks": "Water Temperature Checks",
  "tank inspection": "Tank Inspection",
  "quarterly tank inspection": "Tank Inspection",
  "water hygiene": "Water Hygiene Certificate",
  // Asbestos
  asbestos: "Asbestos Management Survey",
  "asbestos survey": "Asbestos Management Survey",
  "asbestos management survey": "Asbestos Management Survey",
  "asbestos reinspection": "Asbestos Reinspection",
  // Energy & building
  epc: "Energy Performance Certificate",
  "energy performance certificate": "Energy Performance Certificate",
  "energy performance": "Energy Performance Certificate",
  "accessibility audit": "Accessibility Audit",
  "access audit": "Accessibility Audit",
  "building insurance": "Building Insurance Policy",
  "buildings insurance": "Building Insurance Policy",
  "insurance policy": "Building Insurance Policy",
  "insurance schedule": "Insurance Schedule",
  "listed building": "Listed Building Consent Review",
  "listed building consent": "Listed Building Consent Review",
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

export function sanitizeScanTitle(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[\u0000-\u001F]+/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 3) return null;
  return cleaned.slice(0, 120);
}

/**
 * Human record title for Add Record / intake review (e.g. Gas Safety Certificate → Gas Safety Record).
 */
export function naturalLanguageRecordTitle(rawType?: string | null): string | null {
  const mapped = mapIntakeDocumentType(rawType);
  const type = mapped?.type ?? (isMeaningfulSuggestedType(rawType) ? rawType!.trim() : null);
  if (!type) return null;

  if (/\brecord\b/i.test(type)) return type.slice(0, 120);

  const TITLE_OVERRIDES: Partial<Record<IntakeCompliancePreset, string>> = {
    "Fire Certificate": "Fire Safety Record",
    "Electrical Certificate": "Electrical Safety Record",
    "Gas Safety Certificate": "Gas Safety Record",
    EICR: "EICR Record",
    "PAT Test": "PAT Test Record",
    "Energy Performance Certificate": "EPC Record",
    "Fire Risk Assessment": "Fire Risk Assessment Record",
    "Legionella Risk Assessment": "Legionella Risk Assessment Record",
    "Asbestos Management Survey": "Asbestos Survey Record",
    "Building Insurance Policy": "Building Insurance Record",
  };
  const override = TITLE_OVERRIDES[type as IntakeCompliancePreset];
  if (override) return override;

  if (/\bcertificate\b/i.test(type)) {
    return type.replace(/\bcertificate\b/i, "Record").replace(/\s+/g, " ").trim().slice(0, 120);
  }

  if (
    /\b(test|assessment|report|inspection|survey|service|servicing|checks|review|policy|schedule|cleaning)\b/i.test(
      type
    )
  ) {
    return type.slice(0, 120);
  }

  return `${type} Record`.slice(0, 120);
}
