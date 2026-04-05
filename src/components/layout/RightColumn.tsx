import { ReactNode, useMemo } from "react";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { DailyBriefingCard } from "@/components/dashboard/DailyBriefingCard";
import type { IntakeMode } from "@/types/intake";

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
  selectedPropertyIds?: Set<string>;
  onOpenIntake?: (mode: IntakeMode) => void;
}

/**
 * Right Column Component
 * Task Panel with Tabs (Attention, Tasks, Compliance, Schedule)
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
  selectedPropertyIds,
  onOpenIntake
}: RightColumnProps) {
  const embedBriefingInAttention = useMemo(() => {
    if (!selectedPropertyIds || properties.length <= 1) return false;
    return selectedPropertyIds.size === 1;
  }, [selectedPropertyIds, properties.length]);

  const showBriefingAboveTabs = !embedBriefingInAttention;

  return (
    <div className="h-full flex flex-col min-w-0 px-0 w-full md:w-auto">
      {/* Daily Briefing above tabs: all-properties (or single-property org) hub only */}
      {showBriefingAboveTabs && (
        <div className="mb-4 flex-shrink-0 w-full min-w-0 px-[10px] pt-[15px] min-h-[130px] max-[455px]:px-2">
          <DailyBriefingCard
            tasks={tasks}
            selectedPropertyIds={selectedPropertyIds}
            properties={properties}
            variant="full"
          />
        </div>
      )}
      
      {/* Task Panel or custom children — gradient only below Daily Briefing */}
      <div
        className="flex-1 min-h-0 min-w-0 w-full md:w-auto rounded-[23px] shadow-[0px_-2px_2px_0px_rgb(255,255,255)]"
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
            selectedPropertyIds={selectedPropertyIds}
            onOpenIntake={onOpenIntake}
            embedBriefingInAttention={embedBriefingInAttention}
          />
        )}
      </div>
    </div>
  );
}

