/** Parse country / postcode from Google Places or Geocoder address_components. */

export type AddressComponentLike = {
  types?: string[];
  short_name?: string;
  long_name?: string;
  shortText?: string;
  longText?: string;
};

function componentText(
  component: AddressComponentLike,
  preferShort: boolean
): string | null {
  const short = (component.shortText ?? component.short_name ?? "").trim();
  const long = (component.longText ?? component.long_name ?? "").trim();
  const value = preferShort ? short || long : long || short;
  return value || null;
}

function findComponent(
  components: AddressComponentLike[],
  type: string
): AddressComponentLike | undefined {
  return components.find((c) => Array.isArray(c.types) && c.types.includes(type));
}

/** ISO-3166-1 alpha-2. Google uses GB; treat UK as GB. */
export function extractCountryCode(components: unknown): string | null {
  if (!Array.isArray(components)) return null;
  const country = findComponent(components as AddressComponentLike[], "country");
  if (!country) return null;
  const raw = componentText(country, true);
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper === "UK") return "GB";
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  return null;
}

export function extractPostalCode(components: unknown): string | null {
  if (!Array.isArray(components)) return null;
  const postal = findComponent(components as AddressComponentLike[], "postal_code");
  if (!postal) return null;
  const raw = componentText(postal, false);
  if (!raw) return null;
  return raw.toUpperCase().replace(/\s+/g, " ").trim();
}

export function extractCountryAndPostcode(components: unknown): {
  countryCode: string | null;
  postalCode: string | null;
} {
  return {
    countryCode: extractCountryCode(components),
    postalCode: extractPostalCode(components),
  };
}
