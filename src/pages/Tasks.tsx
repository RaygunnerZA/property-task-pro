import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { TaskList } from "@/components/tasks/TaskList";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";
import { PageHeader } from "@/components/design-system/PageHeader";
import { useTasks } from "@/hooks/use-tasks";

const Tasks = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refresh } = useTasks();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Check for ?add=true in URL to open modal
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setShowCreateModal(true);
      // Remove the query param from URL
      navigate('/tasks', { replace: true });
    }
  }, [searchParams, navigate]);

  const handleTaskCreated = (taskId: string) => {
    refresh();
    setShowCreateModal(false);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader>
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
          </div>
          <NeomorphicButton onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </NeomorphicButton>
        </div>
      </PageHeader>

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
