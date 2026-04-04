/**
 * ContextSummaryCard - Framework V2 summary card
 * ~150px max height, 15px tinted band, shadow-e1
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
  /** Narrow layout for asset summary strip: fixed height, tighter padding, no description line */
  variant?: "default" | "compact";
}

export function ContextSummaryCard({
  title,
  count,
  description,
  color,
  onClick,
  ctaLabel,
  className,
  variant = "default",
}: ContextSummaryCardProps) {
  const isClickable = !!onClick;
  const isCompact = variant === "compact";

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
        "rounded-[12px] overflow-hidden shadow-e1 min-h-[100px] max-h-[150px] flex flex-col",
        isCompact && "h-[150px]",
        "transition-all duration-150 ease-out",
        "hover:shadow-e2 hover:-translate-y-0.5",
        isClickable && "cursor-pointer active:scale-[0.99]",
        className
      )}
    >
      {/* 15px tinted band */}
      <div
        className={cn("h-[15px] flex-shrink-0", COLOR_BANDS[color])}
        aria-hidden
      />
      {/* Body - neutral surface */}
      <div
        className={cn(
          "flex-1 min-h-[136px] bg-card flex flex-col",
          isCompact
            ? "px-2.5 pt-[10px] pb-4 gap-[5px] justify-start items-center"
            : "px-5 py-4 gap-2.5"
        )}
      >
        <span
          className={cn(
            "inline-flex w-fit max-w-full items-center justify-center tabular-nums",
            "text-[37px] font-bold leading-none tracking-tight",
            isCompact
              ? "text-[rgba(133,186,188,1)]"
              : "text-foreground",
            "rounded-[10px] px-3 py-1.5 bg-muted/25",
            "shadow-[inset_2px_2px_5px_rgba(0,0,0,0.1),inset_-2px_-2px_6px_rgba(255,255,255,0.88)]",
            isCompact && "text-center"
          )}
        >
          {count}
        </span>
        <span
          className={cn(
            "text-sm font-medium text-foreground",
            isCompact && "w-full text-center"
          )}
        >
          {title}
        </span>
        {!isCompact && description && (
          <span className="text-xs text-muted-foreground line-clamp-1">
            {description}
          </span>
        )}
        {ctaLabel && isClickable && (
          <span
            className={cn(
              "text-xs text-primary font-medium mt-auto",
              isCompact ? "w-full pt-0.5 text-center" : "pt-2"
            )}
          >
            {ctaLabel}
          </span>
        )}
      </div>
    </div>
  );
}
