/** Default Lucide keys + palette colours for a new asset, by type. */

export const ASSET_TYPE_DEFAULT_ICONS: Record<string, string[]> = {
  Boiler: ["flame", "thermometer", "droplets", "gauge", "wrench"],
  HVAC: ["wind", "fan", "snowflake", "thermometer", "wrench"],
  Plumbing: ["droplets", "bath", "waves", "wrench", "package"],
  Electrical: ["zap", "plug", "lightbulb", "cpu", "cog"],
  Vehicle: ["car", "truck", "bike", "bus", "package"],
  Appliance: ["refrigerator", "tv", "speaker", "plug", "package"],
  Other: ["package", "box", "wrench", "cog", "hammer"],
};

export const ASSET_FALLBACK_ICONS = ["package", "box", "wrench", "plug", "cog"];

export function defaultIconsForAssetType(type: string | null | undefined): string[] {
  if (!type) return ASSET_FALLBACK_ICONS;
  return ASSET_TYPE_DEFAULT_ICONS[type] ?? ASSET_FALLBACK_ICONS;
}

/** Palette colours already used by AIIconColorPicker. */
export function defaultColorForAssetType(type: string | null | undefined): string {
  switch (type) {
    case "Boiler":
      return "#F5A623";
    case "HVAC":
      return "#74B9FF";
    case "Plumbing":
      return "#74B9FF";
    case "Electrical":
      return "#FFEAA7";
    case "Vehicle":
      return "#A29BFE";
    case "Appliance":
      return "#96CEB4";
    default:
      return "#96CEB4";
  }
}

export function iconColorFromAssetMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const hex = (metadata as { icon_color_hex?: unknown }).icon_color_hex;
  return typeof hex === "string" && hex.trim() ? hex.trim() : null;
}
