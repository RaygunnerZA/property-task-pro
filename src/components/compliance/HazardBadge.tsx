import { cn } from "@/lib/utils";
import { getHazardLabel, getHazardColor, HAZARD_ICONS, type HazardCategory } from "@/lib/hazards";

interface HazardBadgeProps {
  hazard: string;
  size?: "sm" | "md";
  className?: string;
}

export function HazardBadge({ hazard, size = "sm", className }: HazardBadgeProps) {
  const label = getHazardLabel(hazard);
  const colorClass = getHazardColor(hazard);
  const icon = HAZARD_ICONS[hazard as HazardCategory] ?? "❓";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 font-medium",
        size === "sm" ? "text-[10px] py-0.5" : "text-xs py-1",
        "bg-muted/50",
        colorClass,
        className
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
}
