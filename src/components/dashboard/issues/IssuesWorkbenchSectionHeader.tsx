import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type IssuesWorkbenchSectionHeaderProps = {
  title: string;
  subtitle?: string;
  count?: number;
  /** Grey badge for review queue; muted for recent. */
  countVariant?: "review" | "recent";
  onViewAll?: () => void;
  className?: string;
  /** Optional decorative illustration (Urgent / Open work sections). */
  illustrationSrc?: string;
  spacious?: boolean;
};

/**
 * Issues workbench section header — compact feed style (count + View all) or legacy illustration row.
 */
export function IssuesWorkbenchSectionHeader({
  title,
  subtitle,
  count,
  countVariant = "recent",
  onViewAll,
  className,
  illustrationSrc,
  spacious = false,
}: IssuesWorkbenchSectionHeaderProps) {
  const hasArt = Boolean(illustrationSrc);
  const badgeClass =
    countVariant === "review"
      ? "bg-[#D9D9D9] text-white"
      : "border-0 bg-muted/70 text-[#878787]";

  if (hasArt) {
    return (
      <div
        className={cn(
          "grid w-full min-w-0 items-start gap-x-3 gap-y-1 px-1",
          "grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)_minmax(3.5rem,min(6.25rem,26%))]",
          spacious ? "my-5" : "my-0",
          className
        )}
      >
        <h2 className="min-w-0 w-[90px] text-lg font-semibold leading-tight tracking-wide text-[rgb(42,41,62)]">
          {title}
        </h2>
        {subtitle ? (
          <p className="min-w-0 pt-[5px] text-[11px] leading-snug text-muted-foreground sm:text-xs">{subtitle}</p>
        ) : (
          <span className="min-w-0" aria-hidden />
        )}
        <div className="flex aspect-square w-full max-h-[6.25rem] max-w-[6.25rem] items-end justify-end justify-self-end">
          <img
            src={illustrationSrc}
            alt=""
            className="mb-[-2px] mt-[-2px] h-full w-full overflow-hidden object-contain object-bottom drop-shadow-sm"
            decoding="async"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-w-0 px-0.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold leading-tight text-foreground">{title}</h2>
          {typeof count === "number" ? (
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                badgeClass
              )}
            >
              {count}
            </span>
          ) : null}
        </div>
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium transition-colors",
              countVariant === "review"
                ? "text-[#FF6B6B] hover:text-[#FF6B6B]/80"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            View all
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium",
              countVariant === "review" ? "text-[#FF6B6B]" : "text-muted-foreground"
            )}
          >
            View all
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
      {subtitle ? (
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
