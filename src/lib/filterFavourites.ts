export type FilterFavouriteKind = "option" | "category" | "sort";

export type FilterFavourite = {
  kind: FilterFavouriteKind;
  id: string;
};

const STORAGE_PREFIX = "filla.filter-favourites.v1.";

export function favouriteKey(item: FilterFavourite): string {
  return `${item.kind}:${item.id}`;
}

export function sameFavourite(a: FilterFavourite, b: FilterFavourite): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** Drop index from chip midpoints, left to right. */
export function insertionIndex(midpoints: number[], clientX: number): number {
  let index = 0;
  for (const mid of midpoints) {
    if (clientX > mid) index += 1;
    else break;
  }
  return index;
}

/**
 * Insert or move `item` so it lands at `index` among the other chips.
 * Favourites are aliases — this never removes the source filter.
 */
export function insertFavourite(
  list: FilterFavourite[],
  item: FilterFavourite,
  index: number
): FilterFavourite[] {
  const without = list.filter((entry) => !sameFavourite(entry, item));
  const next = without.slice();
  const at = Math.max(0, Math.min(index, next.length));
  next.splice(at, 0, item);
  return next;
}

export function removeFavourite(
  list: FilterFavourite[],
  item: FilterFavourite
): FilterFavourite[] {
  return list.filter((entry) => !sameFavourite(entry, item));
}

function isFavourite(value: unknown): value is FilterFavourite {
  if (!value || typeof value !== "object") return false;
  const entry = value as FilterFavourite;
  return (
    (entry.kind === "option" || entry.kind === "category" || entry.kind === "sort") &&
    typeof entry.id === "string" &&
    entry.id.length > 0
  );
}

export function readStoredFavourites(storageKey: string): FilterFavourite[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(isFavourite);
  } catch {
    return null;
  }
}

export function writeStoredFavourites(storageKey: string, items: FilterFavourite[]): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(items));
  } catch {
    // A full or blocked store should not break filtering.
  }
}
