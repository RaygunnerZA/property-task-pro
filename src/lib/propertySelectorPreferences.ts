const PINNED_KEY = "filla_property_pinned_default";
const COUNTS_KEY = "filla_property_selection_counts";
const LEARNED_KEY = "filla_property_learned_default";
const SELECTION_THRESHOLD = 5;

function scopedKey(base: string, orgId: string): string {
  return `${base}:${orgId}`;
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

export function getPinnedDefaultPropertyId(orgId: string): string | null {
  const map = readJson<Record<string, string | null>>(PINNED_KEY, {});
  return map[orgId] ?? null;
}

export function setPinnedDefaultPropertyId(orgId: string, propertyId: string | null): void {
  const map = readJson<Record<string, string | null>>(PINNED_KEY, {});
  if (propertyId) {
    map[orgId] = propertyId;
  } else {
    delete map[orgId];
  }
  writeJson(PINNED_KEY, map);
}

export function getLearnedDefaultPropertyId(orgId: string): string | null {
  const map = readJson<Record<string, string | null>>(LEARNED_KEY, {});
  return map[orgId] ?? null;
}

function setLearnedDefaultPropertyId(orgId: string, propertyId: string | null): void {
  const map = readJson<Record<string, string | null>>(LEARNED_KEY, {});
  if (propertyId) {
    map[orgId] = propertyId;
  } else {
    delete map[orgId];
  }
  writeJson(LEARNED_KEY, map);
}

/** Pinned star wins over learned default from repeated selection. */
export function getEffectiveDefaultPropertyId(orgId: string): string | null {
  return getPinnedDefaultPropertyId(orgId) ?? getLearnedDefaultPropertyId(orgId);
}

/**
 * Call when the user picks a single property in the selector.
 * After {@link SELECTION_THRESHOLD} picks of the same property, it becomes the learned default.
 */
export function recordPropertySelection(orgId: string, propertyId: string): void {
  const allCounts = readJson<Record<string, Record<string, number>>>(COUNTS_KEY, {});
  const orgCounts = { ...(allCounts[orgId] ?? {}) };
  orgCounts[propertyId] = (orgCounts[propertyId] ?? 0) + 1;
  allCounts[orgId] = orgCounts;
  writeJson(COUNTS_KEY, allCounts);

  if (orgCounts[propertyId] >= SELECTION_THRESHOLD) {
    setLearnedDefaultPropertyId(orgId, propertyId);
  }
}

export function isPropertyPinnedDefault(orgId: string, propertyId: string): boolean {
  return getPinnedDefaultPropertyId(orgId) === propertyId;
}
