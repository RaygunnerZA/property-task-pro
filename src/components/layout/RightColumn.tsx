import { ReactNode } from "react";
import { TaskPanel } from "@/components/dashboard/TaskPanel";
import { DailyBriefingCard } from "@/components/dashboard/DailyBriefingCard";

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
}

/**
 * Right Column Component
 * Task Panel with Tabs (Tasks, Inbox, Schedule)
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
  filterToApply
}: RightColumnProps) {
  return (
    <div className="h-full flex flex-col min-w-0 px-0 w-full md:w-auto">
      {/* Daily Briefing Card at the top */}
      <div className="mb-4 flex-shrink-0 w-full min-w-0 px-[15px] pt-[15px]">
        <DailyBriefingCard />
      </div>
      
      {/* Task Panel or custom children */}
      <div className="flex-1 min-h-0 min-w-0 w-full md:w-auto">
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
          />
        )}
      </div>
    </div>
  );
}

