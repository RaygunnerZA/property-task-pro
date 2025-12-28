import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, CheckSquare } from "lucide-react";
import { TaskList } from "@/components/tasks/TaskList";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";
import { StandardPage } from "@/components/design-system/StandardPage";
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

      <TaskList />
    </StandardPage>
  );
};

export default Tasks;
