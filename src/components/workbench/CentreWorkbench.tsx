import { useMemo } from "react";
import { WorkbenchTaskFilterBar } from "@/components/workbench/WorkbenchTaskFilterBar";
import { CentreWorkbenchTabStrip } from "@/components/workbench/CentreWorkbenchTabStrip";
import { CentreWorkbenchMobileCalendar } from "@/components/workbench/CentreWorkbenchMobileCalendar";
import { InflowPanel } from "@/components/workbench/InflowPanel";
import { TasksWorkbenchPanel } from "@/components/workbench/TasksWorkbenchPanel";
import { CalendarWorkbenchPanel } from "@/components/workbench/CalendarWorkbenchPanel";
import { IntakeActionButton } from "@/components/intake/IntakeActionButton";
import { cn } from "@/lib/utils";
import type { CentreWorkbenchTab, CentreCalendarView } from "@/lib/centreWorkbenchTabs";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";

const centreScrollClass =
  "box-border max-h-full min-h-0 w-full max-w-[700px] overflow-y-auto px-2 pb-4 max-pane:px-2";

export type CentreWorkbenchProps = MyWorkPanelProps & {
  activeTab: CentreWorkbenchTab;
  onCentreTabChange: (tab: CentreWorkbenchTab) => void;
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  initialCalendarView?: CentreCalendarView;
  hideViewAllLinks?: boolean;
  /**
   * Hide illustrated tab strip below `md` (home-hub phone).
   * On work-surface phone this stays false so Inflow | Tasks | Calendar remain visible.
   */
  hideTabStrip?: boolean;
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
  initialCalendarView,
  hideViewAllLinks = false,
  hideTabStrip = false,
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
        <div
          className={cn(
            "flex shrink-0 items-stretch gap-2",
            activeTab === "tasks" ? "mb-0" : "mb-3",
            hideTabStrip && "hidden md:flex"
          )}
        >
          <CentreWorkbenchTabStrip
            activeTab={activeTab}
            onTabChange={onCentreTabChange}
            className="min-w-0 flex-1"
          />

          {/* Below layout (1480px): no right-rail intake — stack CTAs beside the tab strip. */}
          {onOpenIntake ? (
            <div className="layout:hidden flex w-[148px] shrink-0 flex-col justify-center gap-1.5 self-stretch py-1.5 md:w-[160px] md:py-3">
              <IntakeActionButton
                mode="add_record"
                variant="compact"
                className="h-auto min-h-0 w-full flex-1 justify-center gap-2 px-2.5 text-base font-medium leading-none [&>svg]:h-4 [&>svg]:w-4"
                onClick={() => onOpenIntake("add_record")}
              />
              <IntakeActionButton
                mode="report_issue"
                variant="compact"
                className="h-auto min-h-0 w-full flex-1 justify-center gap-2 px-2.5 text-base font-medium leading-none [&>svg]:h-4 [&>svg]:w-4"
                onClick={() => onOpenIntake("report_issue")}
              />
            </div>
          ) : null}
        </div>

        {activeTab === "tasks" ? (
          showMobileCalendar ? (
            <CentreWorkbenchMobileCalendar
              tasks={tasks}
              properties={properties}
              tasksLoading={tasksLoading}
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
              selectedPropertyIds={selectedPropertyIds}
              className="mb-1"
            />
          ) : null
        ) : (
          <div className="mb-4 flex shrink-0 flex-col gap-3">
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
        )}

        <div key={activeTab} className="panel-enter min-h-0 flex-1">
          {activeTab === "inflow" && <InflowPanel {...sharedPanelProps} />}
          {activeTab === "tasks" && <TasksWorkbenchPanel {...sharedPanelProps} />}
          {activeTab === "calendar" && (
            <CalendarWorkbenchPanel
              {...sharedPanelProps}
              selectedDate={selectedDate}
              initialCalendarView={initialCalendarView}
            />
          )}
        </div>
      </div>
    </div>
  );
}
