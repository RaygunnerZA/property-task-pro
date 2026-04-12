import { ReactNode, useMemo } from "react";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { DailyBriefingCard } from "@/components/dashboard/DailyBriefingCard";
import type { IntakeMode } from "@/types/intake";
import type { RecordsView, WorkbenchIssuesFilter } from "@/lib/propertyRoutes";
import { isAllPropertiesActive } from "@/utils/propertyFilter";

interface RightColumnProps {
  children?: ReactNode;
  tasks?: any[];
  properties?: any[];
  tasksLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  onMessageClick?: (messageId: string) => void;
  selectedItem?: { type: 'task' | 'message'; id: string } | null;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  selectedDate?: Date | undefined;
  filterToApply?: string | null;
  filtersToApply?: string[] | null;
  issuesFilter?: WorkbenchIssuesFilter;
  onIssuesFilterChange?: (filter: WorkbenchIssuesFilter) => void;
  selectedPropertyIds?: Set<string>;
  onOpenIntake?: (mode: IntakeMode) => void;
  recordsView?: RecordsView;
  onRecordsViewChange?: (view: RecordsView) => void;
}

/**
 * Right Column Component
 * Task Panel with Tabs (Issues, Records, Schedule)
 * 
 * Desktop: Dynamic width (1fr), visible
 * Mobile: Full width, stacked below LeftColumn
 */
export function RightColumn({ 
  children, 
  tasks,
  properties,
  tasksLoading,
  onTaskClick, 
  onMessageClick, 
  selectedItem,
  activeTab,
  onTabChange,
  selectedDate,
  filterToApply,
  filtersToApply,
  issuesFilter,
  onIssuesFilterChange,
  selectedPropertyIds,
  onOpenIntake,
  recordsView,
  onRecordsViewChange,
}: RightColumnProps) {
  const showDailyBriefing = useMemo(() => {
    const ids = (properties ?? []).map((p: { id: string }) => p.id);
    if (ids.length === 0) return false;
    const active = selectedPropertyIds ?? new Set(ids);
    return isAllPropertiesActive(active, ids);
  }, [properties, selectedPropertyIds]);

  return (
    <div className="h-full flex flex-col min-w-0 px-0 w-full sm:w-auto">
      {showDailyBriefing && (
        <div className="mb-4 flex-shrink-0 w-full min-w-0 max-sm:px-0 sm:px-[10px] pt-[15px] min-h-[130px] max-pane:px-2">
          <DailyBriefingCard
            tasks={tasks}
            selectedPropertyIds={selectedPropertyIds}
            properties={properties}
            variant="full"
          />
        </div>
      )}

      {/* Task Panel or custom children */}
      <div
        className="flex-1 min-h-0 min-w-0 w-full sm:w-auto rounded-[23px] shadow-[0px_-2px_2px_0px_rgb(255,255,255)]"
        style={{
          background:
            "linear-gradient(0deg, rgba(234, 233, 230, 0) 0%, rgba(239, 238, 235, 0) 77%, rgba(255, 255, 255, 0.5) 100%)",
        }}
      >
        {children || (
          <TaskPanel 
            tasks={tasks}
            properties={properties}
            tasksLoading={tasksLoading}
            onTaskClick={onTaskClick}
            onMessageClick={onMessageClick}
            selectedItem={selectedItem}
            activeTab={activeTab}
            onTabChange={onTabChange}
            selectedDate={selectedDate}
            filterToApply={filterToApply}
            filtersToApply={filtersToApply}
            issuesFilter={issuesFilter}
            onIssuesFilterChange={onIssuesFilterChange}
            selectedPropertyIds={selectedPropertyIds}
            onOpenIntake={onOpenIntake}
            recordsView={recordsView}
            onRecordsViewChange={onRecordsViewChange}
          />
        )}
      </div>
    </div>
  );
}

