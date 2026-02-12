/**
 * Hazard system for Phase 8
 * Categories: fire, electrical, slip, water, structural, obstruction, hygiene, ventilation, unknown
 */

export const HAZARD_CATEGORIES = [
  "fire",
  "electrical",
  "slip",
  "water",
  "structural",
  "obstruction",
  "hygiene",
  "ventilation",
  "unknown",
] as const;

export type HazardCategory = (typeof HAZARD_CATEGORIES)[number];

export const HAZARD_LABELS: Record<HazardCategory, string> = {
  fire: "Fire",
  electrical: "Electrical",
  slip: "Slip/Trip",
  water: "Water",
  structural: "Structural",
  obstruction: "Obstruction",
  hygiene: "Hygiene",
  ventilation: "Ventilation",
  unknown: "Unknown",
};

export const HAZARD_ICONS: Record<HazardCategory, string> = {
  fire: "🔥",
  electrical: "⚡",
  slip: "⚠️",
  water: "💧",
  structural: "🏗️",
  obstruction: "🚧",
  hygiene: "🧼",
  ventilation: "💨",
  unknown: "❓",
};

export const HAZARD_COLORS: Record<HazardCategory, string> = {
  fire: "text-destructive",
  electrical: "text-amber-600",
  slip: "text-amber-600",
  water: "text-blue-600",
  structural: "text-orange-600",
  obstruction: "text-amber-600",
  hygiene: "text-teal-600",
  ventilation: "text-sky-600",
  unknown: "text-muted-foreground",
};

export function getHazardLabel(h: string): string {
  return HAZARD_LABELS[h as HazardCategory] ?? h;
}

export function getHazardColor(h: string): string {
  return HAZARD_COLORS[h as HazardCategory] ?? "text-muted-foreground";
}
