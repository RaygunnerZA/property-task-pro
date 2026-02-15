/**
 * Resolves Lucide icon names (kebab-case from DB) to React components.
 * Used for asset icons from ai_icon_search.
 */
import { icons, Package, type LucideIcon } from "lucide-react";

function kebabToPascal(kebab: string): string {
  return kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

/**
 * Get Lucide icon component by kebab-case name (e.g. "fire-extinguisher").
 * Falls back to Package if not found.
 */
export function getAssetIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName || typeof iconName !== "string") return Package;
  const pascal = kebabToPascal(iconName.trim());
  const Icon = (icons as Record<string, LucideIcon>)[pascal];
  return Icon ?? Package;
}
