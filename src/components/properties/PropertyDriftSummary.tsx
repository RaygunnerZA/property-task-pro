import { AlertTriangle } from "lucide-react";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { usePropertyDrift } from "@/hooks/property/usePropertyDrift";
import { cn } from "@/lib/utils";
import { LoadingState } from "@/components/design-system/LoadingState";

const severityStyles: Record<string, string> = {
  high: "bg-destructive/12 text-destructive",
  medium: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
  low: "bg-muted text-muted-foreground",
};

interface PropertyDriftSummaryProps {
  propertyId: string;
}

/** Compliance drift at this property (expired / expiring portfolio rows). */
export function PropertyDriftSummary({ propertyId }: PropertyDriftSummaryProps) {
  const { drift, isLoading, error } = usePropertyDrift(propertyId);

  return (
    <div className="rounded-lg p-4 shadow-e1 bg-card">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <PanelSectionTitle as="h3">Compliance drift</PanelSectionTitle>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Items in expired or expiring state from your compliance portfolio.
          </p>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading drift…" size="sm" className="py-8" />
      ) : error ? (
        <p className="text-sm text-destructive/90">{error.message}</p>
      ) : !drift.hasDrift ? (
        <p className="text-sm text-muted-foreground">No expired or expiring compliance items.</p>
      ) : (
        <ul className="space-y-2 max-h-[min(280px,40vh)] overflow-y-auto pr-1">
          {drift.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-2 rounded-[10px] border border-border/20 bg-background/40 px-3 py-2 shadow-sm"
            >
              <p className="text-sm text-foreground leading-snug min-w-0">{item.ruleTitle}</p>
              <span
                className={cn(
                  "shrink-0 rounded-[6px] px-1.5 py-0.5 text-[10px] font-mono uppercase",
                  severityStyles[item.severity] ?? severityStyles.low
                )}
              >
                {item.severity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
