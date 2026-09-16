/**
 * High-level property areas for Add Spaces onboarding (floors / zones).
 * Persisted as parent spaces; rooms nest via parent_space_id.
 *
 * Colours stay in the Filla family: brand teal (#8EC9CE), coral (#EB6834),
 * and soft supporting tones (sage, sand, mist) — no neon / purple defaults.
 */

export type PropertyAreaSuggestion = {
  id: string;
  label: string;
  /** Unique fill for the active area chip */
  color: string;
};

export const ONBOARDING_PROPERTY_AREAS: PropertyAreaSuggestion[] = [
  { id: "basement", label: "Basement", color: "#5B8A8E" },
  { id: "ground-floor", label: "Ground Floor", color: "#8EC9CE" },
  { id: "1st-floor", label: "1st Floor", color: "#EB6834" },
  { id: "2nd-floor", label: "2nd Floor", color: "#D4A574" },
  { id: "3rd-floor", label: "3rd Floor", color: "#7EB8A2" },
  { id: "outside", label: "Outside", color: "#A3C4A0" },
  { id: "roof", label: "Roof", color: "#9BB5C9" },
  { id: "parking", label: "Parking", color: "#B5A99A" },
];

export type OnboardingArea = {
  /** Stable local id for UI state */
  id: string;
  name: string;
  color: string;
};

/** Filter-bar matched chip chrome (radius, height, type, neumorphic shadow). */
export const AREA_CHIP_BASE_CLASS =
  "inline-flex h-[28px] shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 py-0 font-mono text-2xs uppercase tracking-wide leading-none select-none cursor-pointer transition-all duration-150";

export const AREA_CHIP_NEUMO_RAISED =
  "shadow-[1px_2px_2px_0px_rgba(0,0,0,0.15),-2px_-2px_2px_0px_rgba(255,255,255,0.7)]";

export const AREA_CHIP_NEUMO_INSET =
  "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]";

export function createAreaId(): string {
  return `area-${crypto.randomUUID()}`;
}

export function shortAreaLabel(name: string): string {
  return name.replace(/\bfloor\b/gi, (m) => (m[0] === "F" ? "Floor" : "floor"));
}

export function areaSpacesRowLabel(areaName: string): string {
  return `${areaName.trim().toUpperCase()} SPACES`;
}

export function getSuggestedAreaColor(name: string): string {
  const key = name.toLowerCase().trim();
  const match = ONBOARDING_PROPERTY_AREAS.find((a) => a.label.toLowerCase() === key);
  if (match) return match.color;
  const palette = ONBOARDING_PROPERTY_AREAS.map((a) => a.color);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length] ?? "#8EC9CE";
}

/** Hex → rgba for overlays (e.g. 0.4 instruction wash). */
export function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return `rgba(142, 201, 206, ${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
