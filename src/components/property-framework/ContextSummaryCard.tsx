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
        "rounded-[12px] overflow-hidden min-h-[100px] max-h-[150px] flex pl-0",
        isCompact
          ? "box-content flex-row h-[150px] shadow-[1.3px_2px_4px_0px_rgba(0,0,0,0.15),inset_2px_2px_2px_0px_rgba(255,255,255,1)]"
          : "flex-col shadow-e1",
        "transition-all duration-150 ease-out",
        "hover:shadow-e2 hover:-translate-y-0.5",
        isClickable && "cursor-pointer active:scale-[0.99]",
        className
      )}
    >
      {/* 15px tinted band — top strip (default) or left strip (compact) */}
      <div
        className={cn(
          "flex-shrink-0",
          isCompact ? "w-[15px] self-stretch min-h-0" : "h-[15px]",
          COLOR_BANDS[color]
        )}
        aria-hidden
      />
      {/* Body - neutral surface */}
      <div
        className={cn(
          "flex flex-col",
          isCompact
            ? "flex-1 min-w-0 min-h-0 self-stretch bg-[rgba(255,255,255,0.6)] px-2.5 pt-[10px] pb-4 gap-[5px] justify-start items-end rounded-[0_12px_12px_0]"
            : "flex-1 min-h-[136px] bg-card px-5 py-4 gap-2.5"
        )}
      >
        <span
          className={cn(
            "inline-flex w-fit max-w-full items-center justify-center tabular-nums",
            "text-[37px] font-bold leading-none tracking-tight",
            isCompact
              ? "text-[rgba(133,186,188,1)]"
              : "text-foreground",
            "rounded-[10px] px-3 py-1.5",
            isCompact
              ? "bg-muted shadow-[inset_2px_2px_5px_0px_rgba(0,0,0,0.1),inset_-2px_-2px_2px_0px_rgba(255,255,255,1)]"
              : "bg-muted/25 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.1),inset_-2px_-2px_6px_rgba(255,255,255,0.88)]",
            isCompact && "text-center"
          )}
        >
          {count}
        </span>
        <span
          className={cn(
            "text-sm font-medium text-foreground",
            isCompact && "w-full text-left"
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
              isCompact ? "w-full pt-0.5 text-right pr-2.5" : "pt-2"
            )}
          >
            {ctaLabel}
          </span>
        )}
      </div>
    </div>
  );
}
