/**
 * Org-wide uniqueness for property icon keys and palette colours (UI + save guards).
 */
import { filterValidLucideIcons } from "@/lib/icon-resolver";

/** Canonical palette for property icon backgrounds; aligns Add Property and Property detail edit. */
export const PROPERTY_COLOR_PALETTE = [
  "#8EC9CE",
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#F5A623",
  "#FFEAA7",
  "#DDA0DD",
  "#A29BFE",
  "#74B9FF",
] as const;

export type PropertyVisualRow = {
  id: string;
  icon_name?: string | null;
  icon_color_hex?: string | null;
};

export function normalizePropertyColorHex(hex: string | null | undefined): string {
  if (hex == null) return "";
  const t = String(hex).trim();
  if (!t) return "";
  let core = t.startsWith("#") ? t.slice(1) : t;
  if (core.length === 3) {
    core = [...core].map((c) => c + c).join("");
  }
  return core.toLowerCase();
}

export function normalizePropertyIconKey(name: string | null | undefined): string {
  const k = (name || "home").trim().toLowerCase();
  return k || "home";
}

export function buildPropertyVisualOccupancy(rows: PropertyVisualRow[]): {
  takenIcons: Set<string>;
  takenColors: Set<string>;
} {
  const takenIcons = new Set<string>();
  const takenColors = new Set<string>();
  for (const p of rows) {
    takenIcons.add(normalizePropertyIconKey(p.icon_name));
    const c = normalizePropertyColorHex(p.icon_color_hex);
    if (c) takenColors.add(c);
  }
  return { takenIcons, takenColors };
}

export function firstFreeColorFromPalette(
  takenColors: Set<string>,
  palette: readonly string[] = PROPERTY_COLOR_PALETTE
): string | undefined {
  for (const c of palette) {
    if (!takenColors.has(normalizePropertyColorHex(c))) return c;
  }
  return undefined;
}

export function firstFreeIconFromList(
  candidates: string[],
  takenIcons: Set<string>
): string | undefined {
  for (const icon of candidates) {
    if (!takenIcons.has(normalizePropertyIconKey(icon))) return icon;
  }
  return undefined;
}

/** Fixed-order home / property icons — always lead the rotation. */
export const PROPERTY_CORE_ICON_POOL = [
  "house",
  "building",
  "building-2",
  "castle",
  "bird",
  "heart",
  "fence",
] as const;

/** Decorative / thematic icons — shuffled after core on each regenerate. */
export const PROPERTY_VARIETY_ICON_POOL = [
  "mountain",
  "cable-car",
  "caravan",
  "umbrella",
  "shell",
  "volleyball",
  "sun",
  "sailboat",
  "fish-symbol",
  "bike",
  "anchor",
  "waves",
  "tree-palm",
  "flower",
  "tree-pine",
  "ice-cream-bowl",
  "cat",
  "rabbit",
  "squirrel",
  "turtle",
  "fish",
  "telescope",
  "chef-hat",
  "martini",
  "wine",
  "cherry",
  "apple",
  "crown",
  "swords",
  "shield",
  "clover",
  "gem",
] as const;

/** Full pool (core + variety) for uniqueness checks and fallbacks. */
export const PROPERTY_DEFAULT_ICON_POOL = [
  ...PROPERTY_CORE_ICON_POOL,
  ...PROPERTY_VARIETY_ICON_POOL,
] as const;

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0 || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Core icons first, then variety in a seed-based random order (changes on regenerate). */
export function buildPropertyIconRotationPool(shuffleSeed: number): string[] {
  const pool = [
    ...PROPERTY_CORE_ICON_POOL,
    ...seededShuffle(PROPERTY_VARIETY_ICON_POOL, shuffleSeed),
  ];
  return filterValidLucideIcons(pool);
}

/** Pick `count` distinct icons from `pool`, starting at `offset` (wraps). */
export function pickIconsFromRotationPool(
  pool: readonly string[],
  offset: number,
  count: number,
  exclude: string[] = []
): string[] {
  const excludeSet = new Set(exclude.map(normalizePropertyIconKey));
  const available = pool.filter((icon) => !excludeSet.has(normalizePropertyIconKey(icon)));
  if (available.length === 0) return [];

  const result: string[] = [];
  for (let i = 0; i < available.length && result.length < count; i++) {
    const icon = available[(offset + i) % available.length];
    const key = normalizePropertyIconKey(icon);
    if (!result.some((r) => normalizePropertyIconKey(r) === key)) {
      result.push(icon);
    }
  }
  return result;
}
