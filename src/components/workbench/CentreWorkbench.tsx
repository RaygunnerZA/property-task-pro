import { useMemo, useState, type ReactNode } from "react";
import { CentreWorkbenchMobileCalendar } from "@/components/workbench/CentreWorkbenchMobileCalendar";
import { TasksWorkbenchPanel } from "@/components/workbench/TasksWorkbenchPanel";
import { CalendarWorkbenchPanel } from "@/components/workbench/CalendarWorkbenchPanel";
import { RecordsWorkbenchPanel } from "@/components/workbench/RecordsWorkbenchPanel";
import { cn } from "@/lib/utils";
import type { CalendarTaskScope } from "@/lib/calendarDayMeta";
import type { CentreWorkbenchTab, CentreCalendarView } from "@/lib/centreWorkbenchTabs";
import type { MyWorkPanelProps } from "@/components/workbench/MyWorkPanel";
import type { RecordsView } from "@/lib/propertyRoutes";

const centreScrollClass =
  "box-border flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-clip overflow-y-visible px-0 pb-4 md:px-2 max-pane:md:px-2";

export type CentreWorkbenchProps = MyWorkPanelProps & {
  activeTab: CentreWorkbenchTab;
  onCentreTabChange: (tab: CentreWorkbenchTab) => void;
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  initialCalendarView?: CentreCalendarView;
  hideViewAllLinks?: boolean;
  /**
   * @deprecated Tab strip removed — section art lives in the left-column title.
   * Kept so call sites compile; no longer rendered.
   */
  hideTabStrip?: boolean;
  onCreateForDate?: (date: Date) => void;
  onCalendarViewChange?: (view: CentreCalendarView) => void;
  onMonthTitleClick?: () => void;
  /** Optional override for Records centre content (defaults to RecordsWorkbenchPanel). */
  recordsContent?: ReactNode;
  recordsView?: RecordsView;
};

/**
 * Centre work column — Tasks · Calendar · Records content.
 * Section switching is via primary nav; illustrated titles live in the left rail.
 */
export function CentreWorkbench({
  activeTab,
  onCentreTabChange: _onCentreTabChange,
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
  hideTabStrip: _hideTabStrip = false,
  onCreateForDate,
  onCalendarViewChange,
  onMonthTitleClick,
  recordsContent,
  recordsView = "all",
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

  const showMobileCalendar = activeTab === "tasks";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-transparent pb-1">
      <div className={centreScrollClass}>
        {showMobileCalendar ? (
          <div className="mt-3 md:hidden">
            <CentreWorkbenchMobileCalendar
              tasks={tasks}
              properties={properties}
              tasksLoading={tasksLoading}
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
              onMonthTitleClick={onMonthTitleClick}
              selectedPropertyIds={selectedPropertyIds}
              taskScope={tasksCalendarScope}
              className="mb-0"
            />
          </div>
        ) : null}

        <div
          key={activeTab}
          className={cn(
            "panel-enter flex min-h-0 min-w-0 flex-col",
            activeTab === "calendar" ? "flex-none" : "min-h-0 flex-1",
            // Title-band padding lives on Tasks/Calendar tab headers (aligns with left H1).
            showMobileCalendar ? "pt-3 md:pt-0" : "pt-0"
          )}
        >
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
              onCreateForDate={onCreateForDate}
              onCalendarViewChange={onCalendarViewChange}
            />
          )}
          {activeTab === "records" &&
            (recordsContent ?? (
              <RecordsWorkbenchPanel
                {...sharedPanelProps}
                recordsView={recordsView}
              />
            ))}
        </div>
      </div>
    </div>
  );
}
