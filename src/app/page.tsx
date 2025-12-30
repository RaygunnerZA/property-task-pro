import { useState, useEffect } from "react";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { LeftColumn } from "@/components/layout/LeftColumn";
import { RightColumn } from "@/components/layout/RightColumn";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { MessageDetailPanel } from "@/components/messaging/MessageDetailPanel";
import { PageHeader } from "@/components/design-system/PageHeader";
import { Calendar as CalendarIcon } from "lucide-react";

// lg breakpoint is 1024px - use this for three-column layout
const LG_BREAKPOINT = 1024;

type SelectedItem = {
  type: 'task' | 'message';
  id: string;
} | null;

export default function Dashboard() {
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= LG_BREAKPOINT);
    };
    
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const handleTaskClick = (taskId: string) => {
    setSelectedItem({ type: 'task', id: taskId });
  };

  const handleMessageClick = (messageId: string) => {
    setSelectedItem({ type: 'message', id: messageId });
  };

  const handleClosePanel = () => {
    setSelectedItem(null);
  };

  // Render third column content
  const thirdColumnContent = selectedItem && isLargeScreen ? (
    selectedItem.type === 'task' ? (
      <TaskDetailPanel 
        taskId={selectedItem.id} 
        onClose={handleClosePanel}
        variant="column"
      />
    ) : (
      <MessageDetailPanel 
        messageId={selectedItem.id} 
        onClose={handleClosePanel}
        variant="column"
      />
    )
  ) : undefined;

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
        rightColumn={
          <RightColumn 
            onTaskClick={handleTaskClick}
            onMessageClick={handleMessageClick}
            selectedItem={selectedItem}
          />
        }
        thirdColumn={thirdColumnContent}
      />
      
      {/* Detail Panel - Modal variant for smaller screens */}
      {selectedItem && !isLargeScreen && (
        selectedItem.type === 'task' ? (
          <TaskDetailPanel 
            taskId={selectedItem.id} 
            onClose={handleClosePanel}
            variant="modal"
          />
        ) : (
          <MessageDetailPanel 
            messageId={selectedItem.id} 
            onClose={handleClosePanel}
            variant="modal"
          />
        )
      )}
    </div>
  );
}

