import type { LucideIcon } from "lucide-react";
import { Cloud, CloudRain, Sun, CloudSun } from "lucide-react";

/** WMO-style condition code → Lucide icon (matches dashboard header mapping). */
export function getWeatherLucideIcon(conditionCode: number | null | undefined): LucideIcon {
  if (conditionCode == null) return Cloud;
  if (conditionCode === 0) return Sun;
  if (conditionCode >= 1 && conditionCode <= 3) return CloudSun;
  if (conditionCode >= 51 && conditionCode <= 67) return CloudRain;
  if (conditionCode >= 80 && conditionCode <= 99) return CloudRain;
  return Cloud;
}
