import { Navigate, useParams, useSearchParams } from "react-router-dom";

/**
 * Shareable task URL (`/task/:id`).
 * Desktop task detail lives in the workbench right column (@Docs/04_UI_System.md),
 * not a full-width page — send the deep link there.
 */
const TaskDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();

  if (!id) {
    return <Navigate to="/tasks" replace />;
  }

  return (
    <Navigate
      to={{ pathname: "/tasks", search: searchParams.toString() }}
      replace
      state={{ openTaskId: id }}
    />
  );
};

export default TaskDetail;
