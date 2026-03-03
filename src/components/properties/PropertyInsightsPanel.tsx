import { useMemo } from "react";
import { QuickActionsSection } from "./QuickActionsSection";
import { GraphInsightPanel } from "@/components/graph/GraphInsightPanel";

interface PropertyInsightsPanelProps {
  propertyId: string;
  tasks?: any[];
  compliance?: any[];
}

/**
 * Property Insights Panel
 * Shows quick actions for the property context.
 * Overview/Daily Briefing is shown in the right column to avoid duplication.
 */
export function PropertyInsightsPanel({
  propertyId,
  tasks = [],
  compliance = [],
}: PropertyInsightsPanelProps) {
  // Calculate insights from property data (retained for potential future use)
  const insights = useMemo(() => {
    const openTasks = tasks.filter(
      (t) => t.status === "open" || t.status === "in_progress"
    );
    const overdueTasks = openTasks.filter((task) => {
      if (!task.due_date) return false;
      try {
        return new Date(task.due_date) < new Date();
      } catch {
        return false;
      }
    });

    const expiringCompliance = compliance.filter(
      (c) => c.expiry_status === "expiring"
    );
    const expiredCompliance = compliance.filter(
      (c) => c.expiry_status === "expired"
    );

    // Group tasks by space/themes for insights
    const spaceTaskCounts: Record<string, number> = {};
    openTasks.forEach((task) => {
      if (task.spaces) {
        try {
          const taskSpaces = typeof task.spaces === 'string' ? JSON.parse(task.spaces) : task.spaces;
          if (Array.isArray(taskSpaces)) {
            taskSpaces.forEach((space: any) => {
              if (space?.id) {
                spaceTaskCounts[space.id] = (spaceTaskCounts[space.id] || 0) + 1;
              }
            });
          }
        } catch {
          // Skip invalid JSON
        }
      }
    });

    const topSpace = Object.entries(spaceTaskCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      openTasksCount: openTasks.length,
      overdueTasksCount: overdueTasks.length,
      expiringComplianceCount: expiringCompliance.length,
      expiredComplianceCount: expiredCompliance.length,
      totalComplianceRisk: expiringCompliance.length + expiredCompliance.length,
      topSpace,
    };
  }, [tasks, compliance]);

  return (
    <div className="space-y-4 p-[15px]">
      <div className="rounded-lg p-4 shadow-e1 bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Graph insights</h3>
        <GraphInsightPanel start={{ type: "property", id: propertyId }} depth={3} variant="full" />
      </div>
      <QuickActionsSection propertyId={propertyId} />
    </div>
  );
}

