import { ReactNode } from "react";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { HomeWorkbenchCentre } from "@/components/workbench/HomeWorkbenchCentre";
import type { IntakeMode } from "@/types/intake";
import type { RecordsView, WorkbenchIssuesFilter, DashboardWorkbenchPanel } from "@/lib/propertyRoutes";
import type { CentreWorkbenchTab } from "@/lib/centreWorkbenchTabs";
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
  recordsView?: RecordsView;
  onRecordsViewChange?: (view: RecordsView) => void;
  workbenchPanel?: DashboardWorkbenchPanel;
  centreWorkbenchTab?: CentreWorkbenchTab;
  onCentreWorkbenchTabChange?: (tab: CentreWorkbenchTab) => void;
  hideCentreTabStrip?: boolean;
}

const panelShellClass = cn(columnShellClass, "rounded-[12px]");

/**
 * Product centre column (DualPaneLayout `rightColumn`).
 * Home → org-wide Attention; `/issues` → property Attention hub; `/records` & `/agenda` → TaskPanel.
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
  issuesFilter,
  onIssuesFilterChange,
  selectedPropertyIds,
  onOpenIntake,
  recordsView,
  onRecordsViewChange,
  workbenchPanel = "home",
  centreWorkbenchTab = "inflow",
  onCentreWorkbenchTabChange,
  hideCentreTabStrip = false,
}: RightColumnProps) {
  const dedicatedTitle =
    workbenchPanel === "records"
      ? "Records"
      : workbenchPanel === "schedule"
        ? "Schedule"
        : undefined;

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
    if (workbenchPanel === "home") {
      return (
        <HomeWorkbenchCentre
          {...sharedTaskListProps}
          activeTab={centreWorkbenchTab}
          onCentreTabChange={onCentreWorkbenchTabChange}
          onTabChange={onTabChange}
          onOpenIntake={onOpenIntake}
          onMessageClick={onMessageClick}
          onAttentionItemSelect={onAttentionItemSelect}
          onRecordsViewChange={onRecordsViewChange}
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
          hideTabStrip={hideCentreTabStrip}
        />
      );
    }

    if (workbenchPanel === "issues") {
      return (
        <HomeWorkbenchCentre
          {...sharedTaskListProps}
          activeTab={centreWorkbenchTab}
          onCentreTabChange={onCentreWorkbenchTabChange}
          onTabChange={onTabChange}
          onOpenIntake={onOpenIntake}
          onMessageClick={onMessageClick}
          onAttentionItemSelect={onAttentionItemSelect}
          onRecordsViewChange={onRecordsViewChange}
          selectedDate={selectedDate}
          onDateSelect={onDateSelect}
          hideViewAllLinks
          hideTabStrip={hideCentreTabStrip}
        />
      );
    }

    return (
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
        selectedPropertyIds={selectedPropertyIds}
        onOpenIntake={onOpenIntake}
        recordsView={recordsView}
        onRecordsViewChange={onRecordsViewChange}
        hideTabs
        pageTitle={dedicatedTitle}
      />
    );
  };

  return (
    <div className={cn(columnShellClass, "h-full px-0 sm:w-auto")}>
      <div className={panelShellClass}>
        {children || renderCentre()}
      </div>
    </div>
  );
}
