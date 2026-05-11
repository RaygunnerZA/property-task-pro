import { formatDistanceToNow } from "date-fns";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { usePropertyTimeline } from "@/hooks/property/usePropertyTimeline";
import { cn } from "@/lib/utils";
import { LoadingState } from "@/components/design-system/LoadingState";

const typeStyles: Record<string, string> = {
  task: "bg-primary/12 text-primary",
  compliance: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
  drift: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
  inspection: "bg-sky-500/12 text-sky-800 dark:text-sky-300",
};

interface PropertyActivityTimelineProps {
  propertyId: string;
}

/**
 * Recent task + audit activity for the scoped property (Insights column).
 */
export function PropertyActivityTimeline({ propertyId }: PropertyActivityTimelineProps) {
  const { events, isLoading, error } = usePropertyTimeline(propertyId);

  return (
    <div className="rounded-lg p-4 shadow-e1 bg-card">
      <PanelSectionTitle as="h3">Property activity</PanelSectionTitle>
      <p className="text-xs text-muted-foreground mt-1 mb-3">
        Recent task events and audit entries for this property.
      </p>

      {isLoading ? (
        <LoadingState message="Loading activity…" size="sm" className="py-8" />
      ) : error ? (
        <p className="text-sm text-destructive/90">{error.message}</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ul className="space-y-2.5 max-h-[min(360px,50vh)] overflow-y-auto pr-1">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex gap-3 rounded-[10px] border border-border/20 bg-background/40 px-3 py-2 shadow-sm"
            >
              <div className="shrink-0 pt-0.5">
                <span
                  className={cn(
                    "inline-flex rounded-[6px] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide",
                    typeStyles[ev.type] ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {ev.type}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground leading-snug">{ev.description}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(ev.date), { addSuffix: true })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
