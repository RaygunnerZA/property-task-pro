import { useMemo } from "react";
import { DailyBriefingCard } from "@/components/dashboard/DailyBriefingCard";
import { QuickActionsSection } from "./QuickActionsSection";

interface PropertyInsightsPanelProps {
  propertyId: string;
  tasks?: any[];
  compliance?: any[];
}

/**
 * Property Insights Panel
 * Reuses DailyBriefingCard component with property-specific data
 * Shows auto-generated insights, environmental widgets, and quick actions
 */
export function PropertyInsightsPanel({
  propertyId,
  tasks = [],
  compliance = [],
}: PropertyInsightsPanelProps) {
  // Calculate insights from property data
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
      {/* Daily Briefing Card - Property-specific insights will be shown via the hook */}
      <DailyBriefingCard showGreeting={false} />

      {/* Quick Actions */}
      <QuickActionsSection propertyId={propertyId} />
    </div>
  );
}

