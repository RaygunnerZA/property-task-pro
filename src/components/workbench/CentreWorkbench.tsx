import { useMemo } from "react";
import { WorkbenchTaskFilterBar } from "@/components/workbench/WorkbenchTaskFilterBar";
import { CentreWorkbenchTabStrip } from "@/components/workbench/CentreWorkbenchTabStrip";
import { CentreWorkbenchMobileCalendar } from "@/components/workbench/CentreWorkbenchMobileCalendar";
import { InflowPanel } from "@/components/workbench/InflowPanel";
import { TasksWorkbenchPanel } from "@/components/workbench/TasksWorkbenchPanel";
import { CalendarWorkbenchPanel } from "@/components/workbench/CalendarWorkbenchPanel";
import { cn } from "@/lib/utils";
import {
  CENTRE_WORKBENCH_TAB_META,
  type CentreWorkbenchTab,
} from "@/lib/centreWorkbenchTabs";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";

const centreScrollClass =
  "box-border max-h-full min-h-0 w-full max-w-[700px] overflow-y-auto px-2 pb-4 max-pane:px-2";

export type CentreWorkbenchProps = MyWorkPanelProps & {
  activeTab: CentreWorkbenchTab;
  onCentreTabChange: (tab: CentreWorkbenchTab) => void;
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  hideViewAllLinks?: boolean;
};

/**
 * Centre work column — Inflow · Tasks · Calendar with search/filter per tab.
 */
export function CentreWorkbench({
  activeTab,
  onCentreTabChange,
  tasks = [],
  properties = [],
  tasksLoading = false,
  onTaskClick,
  selectedTaskId,
  selectedPropertyIds,
  onMessageClick,
  onAttentionItemSelect,
  onOpenIntake,
  onTabChange,
  onRecordsViewChange,
  selectedDate,
  onDateSelect,
  hideViewAllLinks = false,
}: CentreWorkbenchProps) {
  const sharedPanelProps = useMemo(
    () => ({
      tasks,
      properties,
      tasksLoading,
      onTaskClick,
      selectedTaskId,
      selectedPropertyIds,
      onMessageClick,
      onAttentionItemSelect,
      onOpenIntake,
      onTabChange,
      onRecordsViewChange,
      hideViewAllLinks,
    }),
    [
      tasks,
      properties,
      tasksLoading,
      onTaskClick,
      selectedTaskId,
      selectedPropertyIds,
      onMessageClick,
      onAttentionItemSelect,
      onOpenIntake,
      onTabChange,
      onRecordsViewChange,
      hideViewAllLinks,
    ]
  );

  const showMobileCalendar = activeTab === "inflow" || activeTab === "tasks";

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent pb-1">
      <div className={cn(centreScrollClass, "flex flex-1 min-h-0 flex-col")}>
        <CentreWorkbenchTabStrip
          activeTab={activeTab}
          onTabChange={onCentreTabChange}
          className="mb-3 shrink-0"
        />

        <div className="mb-4 flex shrink-0 flex-col">
          <p className="mt-2 flex w-full min-w-0 items-center justify-start px-0 pb-6 text-sm font-normal text-muted-foreground">
            {CENTRE_WORKBENCH_TAB_META[activeTab].description}
          </p>
          {showMobileCalendar ? (
            <CentreWorkbenchMobileCalendar
              tasks={tasks}
              properties={properties}
              tasksLoading={tasksLoading}
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
              selectedPropertyIds={selectedPropertyIds}
            />
          ) : null}
          <WorkbenchTaskFilterBar
            tasks={tasks}
            properties={properties}
            hidePrimaryUrgentChip={activeTab === "inflow"}
          />
        </div>

        <div className="min-h-0 flex-1">
          {activeTab === "inflow" && <InflowPanel {...sharedPanelProps} />}
          {activeTab === "tasks" && <TasksWorkbenchPanel {...sharedPanelProps} />}
          {activeTab === "calendar" && (
            <CalendarWorkbenchPanel
              {...sharedPanelProps}
              selectedDate={selectedDate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
