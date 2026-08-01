import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  workbenchSectionSubtitleClassName,
  workbenchSectionTitleClassName,
} from "@/lib/workbenchSectionTitle";

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
      ? "bg-muted text-white"
      : "border-0 bg-white/70 text-muted-foreground";

  if (hasArt) {
    return (
      <div
        className={cn(
          "flex w-full min-w-0 items-end gap-3 px-2",
          spacious ? "my-5" : "my-0",
          className
        )}
      >
        <div className="min-w-0 flex-1">
          <h2 className={workbenchSectionTitleClassName}>{title}</h2>
          {subtitle ? (
            <p className={cn("mt-0.5", workbenchSectionSubtitleClassName)}>{subtitle}</p>
          ) : null}
        </div>
        <div className="flex aspect-square w-[min(6.25rem,26%)] max-h-[6.25rem] shrink-0 items-end justify-end">
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
    <div className={cn("min-w-0 px-2", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className={workbenchSectionTitleClassName}>{title}</h2>
          {typeof count === "number" ? (
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-card px-1.5 text-caption font-semibold",
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
                ? "text-destructive hover:text-destructive/80"
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
              countVariant === "review" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            View all
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
      {subtitle ? (
        <p className={cn("mt-1", workbenchSectionSubtitleClassName)}>{subtitle}</p>
      ) : null}
    </div>
  );
}
