import { ReactNode } from "react";
import { TaskPanel } from "@/components/dashboard/TaskPanel";

interface RightColumnProps {
  children?: ReactNode;
  tasks?: any[];
  properties?: any[];
  tasksLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  onMessageClick?: (messageId: string) => void;
  selectedItem?: { type: 'task' | 'message'; id: string } | null;
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
  selectedItem 
}: RightColumnProps) {
  return (
    <div className="h-full">
      {children || (
        <TaskPanel 
          tasks={tasks}
          properties={properties}
          tasksLoading={tasksLoading}
          onTaskClick={onTaskClick}
          onMessageClick={onMessageClick}
          selectedItem={selectedItem}
        />
      )}
    </div>
  );
}

