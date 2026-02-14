import { cn } from "@/lib/utils";
import { HazardBadge } from "./HazardBadge";

interface ComplianceCalendarEventProps {
  title: string;
  propertyName?: string | null;
  expiryState: string;
  hazards?: string[] | null;
  aiConfidence?: number | null;
  onClick?: () => void;
}

export function ComplianceCalendarEvent({
  title,
  propertyName,
  expiryState,
  hazards,
  aiConfidence,
  onClick,
}: ComplianceCalendarEventProps) {
  const stateColor =
    expiryState === "expired"
      ? "border-l-destructive bg-destructive/5 dark:bg-destructive/10"
      : expiryState === "expiring"
      ? "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20"
      : "border-l-success bg-success/5 dark:bg-success/10";

  const aiShade =
    aiConfidence != null
      ? aiConfidence >= 0.8
        ? "ring-1 ring-inset ring-primary/20"
        : aiConfidence >= 0.5
        ? "ring-1 ring-inset ring-muted-foreground/15"
        : "ring-1 ring-inset ring-muted-foreground/10"
      : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-2 rounded-lg border-l-4",
        "hover:brightness-95 transition-all",
        stateColor,
        aiShade
      )}
      title={aiConfidence != null ? `AI confidence: ${Math.round(aiConfidence * 100)}%` : undefined}
    >
      <div className="font-medium text-sm text-foreground truncate">{title}</div>
      {propertyName && (
        <div className="text-xs text-muted-foreground truncate">{propertyName}</div>
      )}
      {Array.isArray(hazards) && hazards.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {hazards.slice(0, 3).map((h) => (
            <HazardBadge key={h} hazard={h} size="sm" />
          ))}
          {hazards.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{hazards.length - 3}</span>
          )}
        </div>
      )}
    </button>
  );
}
