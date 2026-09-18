/** England & Wales domestic EPC register helpers. No Deno APIs — vitest-safe. */

export const UK_EPC_PROVIDER = "uk_epc";

export const UK_EPC_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const SCOTTISH_POSTCODE_AREAS = new Set([
  "AB",
  "DD",
  "DG",
  "EH",
  "FK",
  "G",
  "HS",
  "IV",
  "KA",
  "KW",
  "KY",
  "ML",
  "PA",
  "PH",
  "TD",
  "ZE",
]);

export type UkEpcStatus = "found" | "not_found" | "error";

export type UkEpcFacts = {
  current_rating?: string;
  current_efficiency?: number;
  potential_rating?: string;
  potential_efficiency?: number;
  floor_area?: number;
  property_type?: string;
  built_form?: string;
  construction_age_band?: string;
  lodgement_date?: string;
};

/** Outward area letters before the first digit: "SW1A 1AA" → "SW", "G1 1AA" → "G". */
export function postcodeArea(postcode: string): string | null {
  const compact = postcode.toUpperCase().replace(/\s+/g, "");
  const match = compact.match(/^([A-Z]{1,2})\d/);
  return match?.[1] ?? null;
}

export function isEnglandWalesPostcode(postcode: string | null | undefined): boolean {
  if (!postcode?.trim()) return false;
  const area = postcodeArea(postcode);
  if (!area) return false;
  if (area === "BT") return false;
  if (SCOTTISH_POSTCODE_AREAS.has(area)) return false;
  return true;
}

export function shouldLookupUkEpc(input: {
  countryCode?: string | null;
  postalCode?: string | null;
}): boolean {
  const country = (input.countryCode ?? "").trim().toUpperCase();
  const normalised = country === "UK" ? "GB" : country;
  if (normalised !== "GB") return false;
  return isEnglandWalesPostcode(input.postalCode);
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function firstString(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asTrimmedString(row[key]);
    if (value) return value;
  }
  return undefined;
}

function firstNumber(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = asFiniteNumber(row[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

export function mapDomesticSearchRow(row: Record<string, unknown> | null | undefined): {
  sourceId: string | null;
  facts: UkEpcFacts;
} {
  if (!row || typeof row !== "object") {
    return { sourceId: null, facts: {} };
  }

  const nested =
    row.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : row;

  const facts: UkEpcFacts = {};
  const currentRating = firstString(nested, [
    "current_rating",
    "current-energy-rating",
    "current_energy_efficiency_band",
    "currentEnergyEfficiencyBand",
  ]);
  if (currentRating) facts.current_rating = currentRating;

  const currentEfficiency = firstNumber(nested, [
    "current_efficiency",
    "current-energy-efficiency",
    "current_energy_efficiency",
    "currentEnergyEfficiency",
  ]);
  if (currentEfficiency !== undefined) facts.current_efficiency = currentEfficiency;

  const potentialRating = firstString(nested, [
    "potential_rating",
    "potential-energy-rating",
    "potential_energy_efficiency_band",
    "potentialEnergyEfficiencyBand",
  ]);
  if (potentialRating) facts.potential_rating = potentialRating;

  const potentialEfficiency = firstNumber(nested, [
    "potential_efficiency",
    "potential-energy-efficiency",
    "potential_energy_efficiency",
    "potentialEnergyEfficiency",
  ]);
  if (potentialEfficiency !== undefined) facts.potential_efficiency = potentialEfficiency;

  const floorArea = firstNumber(nested, [
    "floor_area",
    "total-floor-area",
    "total_floor_area",
    "totalFloorArea",
  ]);
  if (floorArea !== undefined) facts.floor_area = floorArea;

  const propertyType = firstString(nested, ["property_type", "property-type", "propertyType"]);
  if (propertyType && !/^\d+$/.test(propertyType)) facts.property_type = propertyType;

  const builtForm = firstString(nested, ["built_form", "built-form", "builtForm"]);
  if (builtForm && !/^\d+$/.test(builtForm)) facts.built_form = builtForm;

  const ageBand = firstString(nested, [
    "construction_age_band",
    "construction-age-band",
    "constructionAgeBand",
  ]);
  if (ageBand && !/^\d+$/.test(ageBand)) facts.construction_age_band = ageBand;

  const lodgementDate = firstString(nested, [
    "lodgement_date",
    "lodgement-date",
    "registration_date",
    "registrationDate",
  ]);
  if (lodgementDate) facts.lodgement_date = lodgementDate;

  const sourceId =
    firstString(nested, [
      "lmk-key",
      "lmk_key",
      "certificate_number",
      "certificateNumber",
    ]) ?? null;
  return { sourceId, facts };
}

export function isWithinCooldown(
  retrievedAt: string | null | undefined,
  nowMs: number,
  cooldownMs = UK_EPC_COOLDOWN_MS
): boolean {
  if (!retrievedAt) return false;
  const then = Date.parse(retrievedAt);
  if (!Number.isFinite(then)) return false;
  return nowMs - then < cooldownMs;
}
