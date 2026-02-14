/**
 * ContextSummaryCard - Framework V2 summary card
 * 140px height, 36px tinted band, shadow-e1
 * Used for: Expiring Soon, Expired, Missing (Documents), Active Assets, etc.
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ContextSummaryColor =
  | "teal"
  | "mint"
  | "orange"
  | "red"
  | "amber"
  | "slate";

const COLOR_BANDS: Record<ContextSummaryColor, string> = {
  teal: "bg-primary/25",
  mint: "bg-success/25",
  orange: "bg-accent/25",
  red: "bg-destructive/25",
  amber: "bg-warning/25",
  slate: "bg-muted-foreground/20",
};

interface ContextSummaryCardProps {
  title: string;
  count: number;
  description?: string;
  color: ContextSummaryColor;
  onClick?: () => void;
  ctaLabel?: string;
  className?: string;
}

export function ContextSummaryCard({
  title,
  count,
  description,
  color,
  onClick,
  ctaLabel,
  className,
}: ContextSummaryCardProps) {
  const isClickable = !!onClick;

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-[8px] overflow-hidden shadow-e1 min-h-[100px] max-h-[140px] flex flex-col",
        "transition-all duration-150 ease-out",
        "hover:shadow-e2 hover:-translate-y-0.5",
        isClickable && "cursor-pointer active:scale-[0.99]",
        className
      )}
    >
      {/* 36px tinted band */}
      <div
        className={cn("h-9 flex-shrink-0", COLOR_BANDS[color])}
        aria-hidden
      />
      {/* Body - neutral surface */}
      <div className="flex-1 p-4 bg-card flex flex-col gap-1 min-h-0">
        <span className="text-2xl font-bold text-foreground leading-tight">
          {count}
        </span>
        <span className="text-sm font-medium text-foreground">{title}</span>
        {description && (
          <span className="text-xs text-muted-foreground line-clamp-1">
            {description}
          </span>
        )}
        {ctaLabel && isClickable && (
          <span className="text-xs text-primary font-medium mt-1">{ctaLabel}</span>
        )}
      </div>
    </div>
  );
}
