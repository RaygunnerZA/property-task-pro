import { ReactNode } from "react";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import type { IntakeMode } from "@/types/intake";
import type { RecordsView, WorkbenchIssuesFilter } from "@/lib/propertyRoutes";
import type { DashboardWorkbenchPanel } from "@/lib/propertyRoutes";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";

interface RightColumnProps {
  children?: ReactNode;
  tasks?: any[];
  properties?: any[];
  tasksLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  onMessageClick?: (messageId: string) => void;
  onAttentionItemSelect?: (payload: WorkbenchAttentionSelectPayload) => void;
  selectedItem?: { type: "task" | "message" | "signal"; id: string } | null;
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
  workbenchPanel?: DashboardWorkbenchPanel;
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
  onAttentionItemSelect,
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
  workbenchPanel = "home",
}: RightColumnProps) {
  const dedicatedTitle =
    workbenchPanel === "issues"
      ? "Issues"
      : workbenchPanel === "records"
        ? "Records"
        : workbenchPanel === "schedule"
          ? "Schedule"
          : undefined;
  return (
    <div className="h-full flex flex-col min-w-0 px-0 w-full sm:w-auto">
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
            onAttentionItemSelect={onAttentionItemSelect}
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
            hideTabs={workbenchPanel !== "home"}
            pageTitle={dedicatedTitle}
          />
        )}
      </div>
    </div>
  );
}

