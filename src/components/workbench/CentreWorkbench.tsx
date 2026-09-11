import { useMemo, useState, type ReactNode } from "react";
import { CentreWorkbenchTabStrip } from "@/components/workbench/CentreWorkbenchTabStrip";
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
  "box-border flex min-h-0 min-w-0 w-full max-w-[700px] flex-1 flex-col overflow-x-clip overflow-y-hidden px-2 pb-4 max-pane:px-2";

/**
 * Equal space above and below the tab-strip perforation
 * (32px midpoint, then −10px → 22px).
 */
const TAB_PERFORATION_GAP_CLASS = "mt-[22px]";
const PANEL_BELOW_TABS_GAP_CLASS = "pt-[22px]";

export type CentreWorkbenchProps = MyWorkPanelProps & {
  activeTab: CentreWorkbenchTab;
  onCentreTabChange: (tab: CentreWorkbenchTab) => void;
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  initialCalendarView?: CentreCalendarView;
  hideViewAllLinks?: boolean;
  /**
   * Hide illustrated tab strip below `md` (home-hub phone).
   * On work-surface phone this stays false so Tasks | Calendar | Records remain visible.
   */
  hideTabStrip?: boolean;
  onCreateForDate?: (date: Date) => void;
  /** Optional override for Records centre content (defaults to RecordsWorkbenchPanel). */
  recordsContent?: ReactNode;
  recordsView?: RecordsView;
};

/**
 * Centre work column — Tasks · Calendar · Records (primary workspace).
 * Home/Inflow is a separate surface and does not use this strip.
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
  onCreateForDate,
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
      <div
        className={cn(
          "shrink-0",
          hideTabStrip ? "hidden md:block" : "block"
        )}
      >
        <div className="flex items-stretch gap-2 px-2 max-pane:px-2">
          <CentreWorkbenchTabStrip
            activeTab={activeTab}
            onTabChange={onCentreTabChange}
            className="min-w-0 flex-1"
          />
        </div>
        <div
          className={cn(
            "perforation-section pointer-events-none md:-ml-4 md:w-[calc(100%+1rem)]",
            TAB_PERFORATION_GAP_CLASS
          )}
          aria-hidden
        />
      </div>

      <div className={centreScrollClass}>
        {showMobileCalendar ? (
          <div className="mt-3 md:hidden">
            <CentreWorkbenchMobileCalendar
              tasks={tasks}
              properties={properties}
              tasksLoading={tasksLoading}
              selectedDate={selectedDate}
              onDateSelect={onDateSelect}
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
            showMobileCalendar ? "pt-3 md:pt-[22px]" : PANEL_BELOW_TABS_GAP_CLASS
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
