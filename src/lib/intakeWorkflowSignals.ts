/** Shared intake routing signals (client-side heuristics + UI). */

const MEANINGLESS_TYPE_VALUES = new Set([
  "none",
  "unknown",
  "n/a",
  "na",
  "null",
  "undefined",
  "not_applicable",
  "not applicable",
  "",
]);

export function isMeaningfulSuggestedType(value?: string | null): boolean {
  if (!value) return false;
  const normalised = value.trim().toLowerCase();
  if (!normalised) return false;
  return !MEANINGLESS_TYPE_VALUES.has(normalised);
}

/** Issue / damage language — bias toward Report Issue. */
export const ISSUE_SIGNAL_PATTERN =
  /leak(?:ing)?|water damage|broken|cracked|damaged|corrosion|rust|mould|mold|blocked|loose|exposed wire|not working|fault|stain|dripping/i;

/** Certificate / record language in OCR or filenames. */
export const COMPLIANCE_TEXT_PATTERN =
  /certificate|safety certificate|gas safe|epc|fire extinguisher|pat test|eicr|renewal|expiry|expires|expiration|valid until|inspection report|compliance record/i;

/** Stricter: labels alone must look document-like (not bare equipment nouns). */
export const DOCUMENT_LABEL_PATTERN =
  /certificate|expiry|expires|gas safe|eicr|epc|pat test|compliance|renewal|inspection report/i;

/** Equipment nouns — never sufficient alone for compliance routing. */
export const EQUIPMENT_ONLY_PATTERN =
  /\b(boiler|appliance|pipe|pipes|hvac|pump|extinguisher|db board|distribution board|meter|plant room|heating|water heater|fuse board)\b/i;

export function textHasIssueSignals(text: string): boolean {
  return ISSUE_SIGNAL_PATTERN.test(text);
}

export function textHasComplianceDocumentSignals(text: string): boolean {
  return COMPLIANCE_TEXT_PATTERN.test(text);
}

export function labelsSuggestComplianceDocument(labelText: string): boolean {
  const trimmed = labelText.trim();
  if (!trimmed) return false;
  if (!DOCUMENT_LABEL_PATTERN.test(trimmed)) return false;
  if (EQUIPMENT_ONLY_PATTERN.test(trimmed) && !COMPLIANCE_TEXT_PATTERN.test(trimmed)) {
    return false;
  }
  return true;
}

export function hasUsefulComplianceScanResult(
  specificType: string | null | undefined,
  formattedExpiry: string | null | undefined
): boolean {
  return isMeaningfulSuggestedType(specificType) || Boolean(formattedExpiry?.trim());
}
