import { useNavigate, useParams } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

/**
 * Full-screen task detail route (`/task/:id`).
 * Reuses TaskDetailPanel with the same V2.1 contexts as desktop context panels.
 */
const TaskDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    navigate("/tasks", { replace: true });
    return null;
  }

  return (
    <StandardPageWithBack
      title="Task"
      backTo="/tasks"
      icon={<CheckSquare className="h-5 w-5" />}
      maxWidth="full"
      contentClassName="flex flex-col min-h-0 p-0 md:p-0"
    >
      <div className="flex flex-1 flex-col min-h-[calc(100dvh-8rem)] md:min-h-[70vh]">
        <TaskDetailPanel
          taskId={id}
          onClose={() => navigate("/tasks")}
          variant="column"
        />
      </div>
    </StandardPageWithBack>
  );
};

export default TaskDetail;
