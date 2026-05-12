import { formatDistanceToNow } from "date-fns";
import { Users } from "lucide-react";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { usePropertyVendors } from "@/hooks/property/usePropertyVendors";
import { LoadingState } from "@/components/design-system/LoadingState";

interface PropertyAssigneesSectionProps {
  propertyId: string;
}

/**
 * Assignees with tasks on this property (from `tasks_view` + member roles).
 * Labelled "Field assignees" to avoid implying only vendor orgs.
 */
export function PropertyAssigneesSection({ propertyId }: PropertyAssigneesSectionProps) {
  const { vendorActivity, isLoading, error } = usePropertyVendors(propertyId);

  return (
    <div className="rounded-lg p-4 shadow-e1 bg-card">
      <div className="flex items-start gap-2">
        <Users className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <PanelSectionTitle as="h3">Field assignees</PanelSectionTitle>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            People assigned to tasks on this property (role from membership).
          </p>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading assignees…" size="sm" className="py-8" />
      ) : error ? (
        <p className="text-sm text-destructive/90">{error.message}</p>
      ) : vendorActivity.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assigned tasks on this property yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {vendorActivity.map((v, i) => (
            <li
              key={`${v.vendorName}-${i}`}
              className="flex flex-col gap-0.5 rounded-[10px] border border-border/20 bg-background/40 px-3 py-2 shadow-sm"
            >
              <p className="text-sm font-medium text-foreground">{v.vendorName}</p>
              <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                <span>{v.tasksCompleted} completed</span>
                {v.lastVisit ? (
                  <span>
                    Last activity{" "}
                    {formatDistanceToNow(new Date(v.lastVisit), { addSuffix: true })}
                  </span>
                ) : (
                  <span>No dated activity</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
