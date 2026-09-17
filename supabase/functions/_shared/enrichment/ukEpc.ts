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

export function mapDomesticSearchRow(row: Record<string, unknown> | null | undefined): {
  sourceId: string | null;
  facts: UkEpcFacts;
} {
  if (!row || typeof row !== "object") {
    return { sourceId: null, facts: {} };
  }

  const facts: UkEpcFacts = {};
  const currentRating = asTrimmedString(row["current-energy-rating"]);
  if (currentRating) facts.current_rating = currentRating;

  const currentEfficiency = asFiniteNumber(row["current-energy-efficiency"]);
  if (currentEfficiency !== undefined) facts.current_efficiency = currentEfficiency;

  const potentialRating = asTrimmedString(row["potential-energy-rating"]);
  if (potentialRating) facts.potential_rating = potentialRating;

  const potentialEfficiency = asFiniteNumber(row["potential-energy-efficiency"]);
  if (potentialEfficiency !== undefined) facts.potential_efficiency = potentialEfficiency;

  const floorArea = asFiniteNumber(row["total-floor-area"]);
  if (floorArea !== undefined) facts.floor_area = floorArea;

  const propertyType = asTrimmedString(row["property-type"]);
  if (propertyType) facts.property_type = propertyType;

  const builtForm = asTrimmedString(row["built-form"]);
  if (builtForm) facts.built_form = builtForm;

  const ageBand = asTrimmedString(row["construction-age-band"]);
  if (ageBand) facts.construction_age_band = ageBand;

  const lodgementDate = asTrimmedString(row["lodgement-date"]);
  if (lodgementDate) facts.lodgement_date = lodgementDate;

  const sourceId = asTrimmedString(row["lmk-key"]) ?? null;
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
