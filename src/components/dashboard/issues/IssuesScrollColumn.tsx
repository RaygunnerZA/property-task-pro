import { cn } from "@/lib/utils";
import { IssuesWorkbenchSectionHeader } from "@/components/dashboard/issues/IssuesWorkbenchSectionHeader";

type IssuesScrollColumnProps<T extends { id: string }> = {
  title: string;
  subtitle?: string;
  countVariant?: "review" | "recent";
  items: T[];
  /** Badge count when previewing a subset; defaults to `items.length`. */
  totalCount?: number;
  emptyTitle: string;
  emptyDescription: string;
  renderCard: (item: T) => React.ReactNode;
  className?: string;
  onViewAll?: () => void;
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
}: IssuesScrollColumnProps<T>) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl bg-transparent py-3 sm:py-4",
        className
      )}
    >
      <IssuesWorkbenchSectionHeader
        title={title}
        subtitle={subtitle}
        count={totalCount ?? items.length}
        countVariant={countVariant}
        onViewAll={onViewAll}
      />

      {items.length === 0 ? (
        <div className="mt-3 space-y-1 rounded-xl bg-muted/20 px-3 py-2.5">
          <p className="text-xs font-medium text-foreground/90">{emptyTitle}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{emptyDescription}</p>
        </div>
      ) : (
        <div className="mt-3 divide-y divide-input-bg">
          {items.map((item) => (
            <div key={item.id} className="min-w-0 py-2.5 first:pt-0 last:pb-0">
              {renderCard(item)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
