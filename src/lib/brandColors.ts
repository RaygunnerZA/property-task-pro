/** Filla brand primary — used for org/global header strips when no property colour applies. */
export const FILLA_TURQUOISE = "#8EC9CE";

/**
 * Header accent for gradient strips.
 * Property-scoped surfaces may pass a property colour; everything else uses Filla turquoise.
 */
export function resolveHeaderAccentColor(
  propertyColor?: string | null,
  options?: { propertyScoped?: boolean },
): string {
  if (options?.propertyScoped) {
    const hex = propertyColor?.trim();
    if (hex) return hex;
  }
  return FILLA_TURQUOISE;
}
