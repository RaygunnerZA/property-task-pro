/**
 * Lucide icons for property chips/cards. Keys match `properties.icon_name` (lowercase).
 * Unknown names fall back to `getAssetIcon` (e.g. AI-suggested icons).
 */
import {
  Home,
  Building2,
  Hotel,
  Warehouse,
  Store,
  Castle,
  Landmark,
  Trees,
  Factory,
  School,
  type LucideIcon,
} from "lucide-react";
import { getAssetIcon } from "@/lib/icon-resolver";

export const PROPERTY_CHIP_ICON_MAP = {
  home: Home,
  building: Building2,
  hotel: Hotel,
  warehouse: Warehouse,
  store: Store,
  castle: Castle,
  landmark: Landmark,
  trees: Trees,
  factory: Factory,
  school: School,
} as const;

export function getPropertyChipIcon(iconName: string | null | undefined): LucideIcon {
  const k = (iconName || "home").trim().toLowerCase();
  const mapped = PROPERTY_CHIP_ICON_MAP[k as keyof typeof PROPERTY_CHIP_ICON_MAP];
  return mapped ?? getAssetIcon(iconName);
}
