import { ReactNode } from "react";
import { TaskPanel } from "@/components/dashboard/TaskPanel";

interface RightColumnProps {
  children?: ReactNode;
  onTaskClick?: (taskId: string) => void;
}

/**
 * Right Column Component
 * Task Panel with Tabs (Tasks, Inbox, Schedule)
 * 
 * Desktop: Dynamic width (1fr), visible
 * Mobile: Full width, stacked below LeftColumn
 */
export function RightColumn({ children, onTaskClick }: RightColumnProps) {
  return (
    <div className="h-full">
      {children || <TaskPanel onTaskClick={onTaskClick} />}
    </div>
  );
}

