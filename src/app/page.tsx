import { useState } from "react";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { LeftColumn } from "@/components/layout/LeftColumn";
import { RightColumn } from "@/components/layout/RightColumn";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Calendar as CalendarIcon } from "lucide-react";

export default function Dashboard() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleClosePanel = () => {
    setSelectedTaskId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader>
        <div className="mx-auto px-4 pt-[50px] pb-4 flex items-center justify-between max-w-full">
          <div className="flex items-center gap-3">
            <span className="icon-primary shrink-0">
              <CalendarIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-foreground leading-tight">Today</h1>
            </div>
          </div>
        </div>
      </PageHeader>
      
      <DualPaneLayout
        leftColumn={<LeftColumn />}
        rightColumn={<RightColumn onTaskClick={handleTaskClick} />}
      />
      
      {/* Task Detail Panel - Renders over Right Column when task is selected */}
      {selectedTaskId && (
        <TaskDetailPanel taskId={selectedTaskId} onClose={handleClosePanel} />
      )}
    </div>
  );
}

