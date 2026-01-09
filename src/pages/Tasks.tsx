import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, CheckSquare } from "lucide-react";
import { TaskList } from "@/components/tasks/TaskList";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";
import { StandardPage } from "@/components/design-system/StandardPage";
import { useQueryClient } from "@tanstack/react-query";

const Tasks = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Check for ?add=true in URL to open modal
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setShowCreateModal(true);
      // Remove the query param from URL
      navigate('/tasks', { replace: true });
    }
  }, [searchParams, navigate]);

  const handleTaskCreated = (taskId: string) => {
    // Invalidate tasks query to refresh
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    setShowCreateModal(false);
  };

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleCloseTaskDetail = () => {
    setSelectedTaskId(null);
  };

  return (
    <StandardPage
      title="Tasks"
      icon={<CheckSquare className="h-6 w-6" />}
      action={
        <NeomorphicButton size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </NeomorphicButton>
      }
      maxWidth="md"
    >
      <CreateTaskModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
        onTaskCreated={handleTaskCreated}
      />

      <TaskList onTaskClick={handleTaskClick} selectedTaskId={selectedTaskId} />

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={handleCloseTaskDetail}
          variant="modal"
        />
      )}
    </StandardPage>
  );
};

export default Tasks;
