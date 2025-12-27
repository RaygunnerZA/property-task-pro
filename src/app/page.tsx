import { useState } from "react";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { LeftColumn } from "@/components/layout/LeftColumn";
import { RightColumn } from "@/components/layout/RightColumn";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

export default function Dashboard() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleClosePanel = () => {
    setSelectedTaskId(null);
  };

  return (
    <>
      <DualPaneLayout
        leftColumn={<LeftColumn />}
        rightColumn={<RightColumn onTaskClick={handleTaskClick} />}
      />
      
      {/* Task Detail Panel - Renders over Right Column when task is selected */}
      {selectedTaskId && (
        <TaskDetailPanel taskId={selectedTaskId} onClose={handleClosePanel} />
      )}
    </>
  );
}

