/**
 * Org-wide uniqueness for property icon keys and palette colours (UI + save guards).
 */

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
