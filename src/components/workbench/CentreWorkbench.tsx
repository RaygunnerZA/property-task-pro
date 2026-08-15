import { useMemo, useState } from "react";
import { CentreWorkbenchTabStrip } from "@/components/workbench/CentreWorkbenchTabStrip";
import { CentreWorkbenchMobileCalendar } from "@/components/workbench/CentreWorkbenchMobileCalendar";
import { InflowPanel } from "@/components/workbench/InflowPanel";
import { TasksWorkbenchPanel } from "@/components/workbench/TasksWorkbenchPanel";
import { CalendarWorkbenchPanel } from "@/components/workbench/CalendarWorkbenchPanel";
import { IntakeActionButton } from "@/components/intake/IntakeActionButton";
import { cn } from "@/lib/utils";
import type { CalendarTaskScope } from "@/lib/calendarDayMeta";
import type { CentreWorkbenchTab, CentreCalendarView } from "@/lib/centreWorkbenchTabs";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";

const centreScrollClass =
  "box-border max-h-full min-h-0 min-w-0 w-full max-w-[700px] overflow-x-clip overflow-y-auto px-2 pb-4 max-pane:px-2";

/** Space from the tab strip’s white bottom border to the first panel title. */
const PANEL_BELOW_TABS_GAP_CLASS = "pt-[55px]";

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
  onOpenAddToFilla,
  onTabChange,
  onRecordsViewChange,
  selectedDate,
  onDateSelect,
  initialCalendarView,
  hideViewAllLinks = false,
  hideTabStrip = false,
}: CentreWorkbenchProps) {
  /** Driven by Tasks All / My tabs so the phone calendar matches the list scope. */
  const [tasksCalendarScope, setTasksCalendarScope] = useState<CalendarTaskScope>("all");

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
      onOpenAddToFilla,
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
      onOpenAddToFilla,
      onTabChange,
      onRecordsViewChange,
      hideViewAllLinks,
    ]
  );

  const showMobileCalendar = activeTab === "inflow" || activeTab === "tasks";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-transparent pb-1">
      <div
        className={cn(
          "shrink-0",
          // Avoid `flex` + `hidden` on the same node — last utility in the stylesheet wins.
          hideTabStrip ? "hidden md:block" : "block"
        )}
      >
        <div className="flex items-stretch gap-2 px-2 max-pane:px-2">
          <CentreWorkbenchTabStrip
            activeTab={activeTab}
            onTabChange={onCentreTabChange}
            className="min-w-0 flex-1"
          />

          {/* Tablet/desktop below layout: CTAs beside tab strip. Phone uses FAB instead. */}
          {onOpenIntake ? (
            <div className="hidden w-[148px] shrink-0 flex-col justify-center gap-1.5 self-center md:flex layout:hidden">
              <IntakeActionButton
                mode="report_issue"
                variant="micro"
                className="h-9 min-h-9 w-full justify-center gap-1.5 px-2.5 text-sm font-semibold leading-none"
                onClick={() => onOpenIntake("report_issue")}
              />
              <IntakeActionButton
                mode="add_record"
                variant="micro"
                className="h-9 min-h-9 w-full justify-center gap-1.5 px-2.5 text-sm font-semibold leading-none"
                onClick={() => onOpenIntake("add_record")}
              />
            </div>
          ) : null}
        </div>
        <div
          className="perforation-section pointer-events-none mt-4 md:-ml-4 md:w-[calc(100%+1rem)]"
          aria-hidden
        />
      </div>

      <div className={cn(centreScrollClass, "flex flex-1 min-h-0 flex-col")}>
        {/* Phone only — does not affect the 55px desktop gap below the tab border. */}
        {showMobileCalendar ? (
          <div className="mt-3 md:hidden">
            <CentreWorkbenchMobileCalendar
              tasks={tasks}
              properties={properties}
              tasksLoading={tasksLoading}
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
              selectedPropertyIds={selectedPropertyIds}
              taskScope={activeTab === "tasks" ? tasksCalendarScope : undefined}
              className="mb-0"
            />
          </div>
        ) : null}

        <div
          key={activeTab}
          className={cn(
            // flex-col so panels can claim the full height and scroll their lists internally.
            "panel-enter flex min-h-0 flex-1 flex-col",
            // Inflow / Tasks / Calendar: 55px from tab border → first title.
            // Phone with week calendar above: tighter gap after the calendar.
            showMobileCalendar ? "pt-3 md:pt-[55px]" : PANEL_BELOW_TABS_GAP_CLASS
          )}
        >
          {activeTab === "inflow" && <InflowPanel {...sharedPanelProps} />}
          {activeTab === "tasks" && (
            <TasksWorkbenchPanel
              {...sharedPanelProps}
              onCalendarTaskScopeChange={setTasksCalendarScope}
            />
          )}
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
