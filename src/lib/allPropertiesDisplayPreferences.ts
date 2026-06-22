const DISPLAY_KEY = "filla_all_properties_display";

export type AllPropertiesDisplaySettings = {
  title?: string | null;
  subtitle?: string | null;
};

function scopedKey(orgId: string): string {
  return `${DISPLAY_KEY}:${orgId}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

export function getAllPropertiesDisplaySettings(orgId: string): AllPropertiesDisplaySettings {
  return readJson<AllPropertiesDisplaySettings>(scopedKey(orgId), {});
}

export function setAllPropertiesDisplaySettings(
  orgId: string,
  settings: AllPropertiesDisplaySettings
): void {
  writeJson(scopedKey(orgId), settings);
}

export function resolveAllPropertiesTitle(
  settings: AllPropertiesDisplaySettings | undefined,
  fallback = "All properties"
): string {
  const trimmed = settings?.title?.trim();
  return trimmed || fallback;
}

export function resolveAllPropertiesSubtitle(
  settings: AllPropertiesDisplaySettings | undefined,
  propertyCount: number
): string {
  const trimmed = settings?.subtitle?.trim();
  if (trimmed) return trimmed;
  const label = propertyCount === 1 ? "property" : "properties";
  return `${propertyCount} ${label} in your portfolio`;
}
