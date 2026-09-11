import { ReactNode } from "react";
import { HomeWorkbenchCentre } from "@/components/workbench/HomeWorkbenchCentre";
import { CentreWorkbench } from "@/components/workbench/CentreWorkbench";
import { RecordsWorkbenchPanel } from "@/components/workbench/RecordsWorkbenchPanel";
import type { IntakeMode } from "@/types/intake";
import type { RecordsView, WorkbenchIssuesFilter, DashboardWorkbenchPanel } from "@/lib/propertyRoutes";
import type { CentreWorkbenchTab, CentreCalendarView } from "@/lib/centreWorkbenchTabs";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";
import { cn } from "@/lib/utils";
import { columnShellClass } from "@/lib/layoutClasses";

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
  onDateSelect?: (date: Date | undefined) => void;
  filterToApply?: string | null;
  filtersToApply?: string[] | null;
  issuesFilter?: WorkbenchIssuesFilter;
  onIssuesFilterChange?: (filter: WorkbenchIssuesFilter) => void;
  selectedPropertyIds?: Set<string>;
  onOpenIntake?: (mode: IntakeMode) => void;
  /** Opens Add to Filla after promoting an external email signal. */
  onOpenAddToFilla?: () => void;
  recordsView?: RecordsView;
  onRecordsViewChange?: (view: RecordsView) => void;
  workbenchPanel?: DashboardWorkbenchPanel;
  centreWorkbenchTab?: CentreWorkbenchTab;
  onCentreWorkbenchTabChange?: (tab: CentreWorkbenchTab) => void;
  calendarInitialView?: CentreCalendarView;
  hideCentreTabStrip?: boolean;
  onCreateForDate?: (date: Date) => void;
}

const panelShellClass = cn(columnShellClass, "h-full min-h-0 rounded-xl");

/**
 * Product centre column (DualPaneLayout `rightColumn`).
 * Home → standalone Inflow; workspace → Tasks · Calendar · Records.
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
  onDateSelect,
  filterToApply,
  filtersToApply,
  selectedPropertyIds,
  onOpenIntake,
  onOpenAddToFilla,
  recordsView,
  onRecordsViewChange,
  workbenchPanel = "home",
  centreWorkbenchTab = "tasks",
  onCentreWorkbenchTabChange,
  calendarInitialView,
  hideCentreTabStrip = false,
  onCreateForDate,
}: RightColumnProps) {
  const isPrimaryWorkspace =
    workbenchPanel === "workspace" ||
    workbenchPanel === "records" ||
    workbenchPanel === "schedule";

  const sharedTaskListProps = {
    tasks,
    properties,
    tasksLoading,
    onTaskClick,
    selectedTaskId: selectedItem?.type === "task" ? selectedItem.id : undefined,
    filterToApply,
    filtersToApply,
    selectedPropertyIds,
  };

  const renderCentre = () => {
    if (workbenchPanel === "home" || workbenchPanel === "issues") {
      return (
        <HomeWorkbenchCentre
          {...sharedTaskListProps}
          onTabChange={onTabChange}
          onOpenIntake={onOpenIntake}
          onOpenAddToFilla={onOpenAddToFilla}
          onMessageClick={onMessageClick}
          onAttentionItemSelect={onAttentionItemSelect}
          onRecordsViewChange={onRecordsViewChange}
        />
      );
    }

    if (isPrimaryWorkspace && onCentreWorkbenchTabChange) {
      const tab: CentreWorkbenchTab =
        workbenchPanel === "records"
          ? "records"
          : workbenchPanel === "schedule"
            ? "calendar"
            : centreWorkbenchTab;

      return (
        <CentreWorkbench
          {...sharedTaskListProps}
          activeTab={tab}
          onCentreTabChange={onCentreWorkbenchTabChange}
          onTabChange={onTabChange}
          onOpenIntake={onOpenIntake}
          onOpenAddToFilla={onOpenAddToFilla}
          onMessageClick={onMessageClick}
          onAttentionItemSelect={onAttentionItemSelect}
          onRecordsViewChange={onRecordsViewChange}
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
          initialCalendarView={calendarInitialView}
          hideTabStrip={hideCentreTabStrip}
          onCreateForDate={onCreateForDate}
          recordsView={recordsView}
        />
      );
    }

    return (
      <RecordsWorkbenchPanel
        {...sharedTaskListProps}
        onOpenIntake={onOpenIntake}
        onRecordsViewChange={onRecordsViewChange}
        recordsView={recordsView}
      />
    );
  };

  return (
    <div className={cn(columnShellClass, "h-full px-0 sm:w-auto")}>
      <div className={panelShellClass}>{children || renderCentre()}</div>
    </div>
  );
}
