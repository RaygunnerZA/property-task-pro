import { cn } from "@/lib/utils";
import { IssuesWorkbenchSectionHeader } from "@/components/dashboard/issues/IssuesWorkbenchSectionHeader";
import { WorkbenchHorizontalScroller } from "@/components/workbench/WorkbenchHorizontalScroller";

type IssuesScrollColumnProps<T extends { id: string }> = {
  title: string;
  subtitle?: string;
  countVariant?: "review" | "recent";
  items: T[];
  /** Badge count when previewing a subset; defaults to `items.length`. */
  totalCount?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  renderCard: (item: T) => React.ReactNode;
  className?: string;
  onViewAll?: () => void;
  /** Horizontal scroll row vs stacked vertical list. */
  layout?: "vertical" | "horizontal";
  /** Width of each card in horizontal layout. */
  horizontalItemClassName?: string;
  /** Suppress built-in section header (parent provides its own). */
  hideHeader?: boolean;
};

/**
 * White card section for Issues feed (Needs review / Recent signals).
 */
export function IssuesScrollColumn<T extends { id: string }>({
  title,
  subtitle,
  countVariant = "recent",
  items,
  totalCount,
  emptyTitle,
  emptyDescription,
  renderCard,
  className,
  onViewAll,
  layout = "vertical",
  horizontalItemClassName = "w-[min(100vw-2.5rem,300px)] flex-shrink-0",
  hideHeader = false,
}: IssuesScrollColumnProps<T>) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl bg-transparent",
        hideHeader ? "!mt-0 py-0 sm:py-0" : "py-3 sm:py-4",
        className
      )}
    >
      {!hideHeader && (
      <IssuesWorkbenchSectionHeader
        title={title}
        subtitle={subtitle}
        count={totalCount ?? items.length}
        countVariant={countVariant}
        onViewAll={onViewAll}
      />
      )}

      {items.length === 0 ? (
        emptyTitle ? (
        <div className="mt-3 space-y-1 rounded-xl bg-muted/20 px-3 py-2.5">
          <p className="text-xs font-medium text-foreground/90">{emptyTitle}</p>
          {emptyDescription ? (
            <p className="text-[11px] leading-relaxed text-muted-foreground">{emptyDescription}</p>
          ) : null}
        </div>
        ) : null
      ) : layout === "horizontal" ? (
        <WorkbenchHorizontalScroller className="mt-3">
          {items.map((item) => (
            <div key={item.id} className={cn("min-w-0", horizontalItemClassName)}>
              {renderCard(item)}
            </div>
          ))}
        </WorkbenchHorizontalScroller>
      ) : (
        <div className="mt-3 divide-y divide-input-bg">
          {items.map((item) => (
            <div key={item.id} className="min-w-0 pt-2.5 pb-0 first:pt-0">
              {renderCard(item)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
