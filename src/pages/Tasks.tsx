import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { TaskList } from "@/components/tasks/TaskList";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTasks } from "@/hooks/use-tasks";

const Tasks = () => {
  const navigate = useNavigate();
  const { refresh } = useTasks();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleTaskCreated = (taskId: string) => {
    refresh();
    setShowCreateModal(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header
        className={cn(
          "sticky top-0 z-40",
          "bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9]",
          "shadow-[inset_0_-1px_2px_rgba(0,0,0,0.05)]"
        )}
      >
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className={cn(
              "rounded-xl bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9]",
              "shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7),inset_1px_1px_1px_rgba(255,255,255,0.6)]",
              "hover:scale-[1.01] active:scale-[0.99] transition-all duration-150",
              "text-foreground border-0"
            )}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>
      </header>

      <CreateTaskModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
        onTaskCreated={handleTaskCreated}
      />

      <div className="max-w-md mx-auto px-4 py-6">
        <TaskList />
      </div>

      <BottomNav />
    </div>
  );
};

export default Tasks;
