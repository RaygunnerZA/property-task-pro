import Dashboard from "@/app/page";

/**
 * Primary workspace — Tasks tab (`/tasks`).
 * Centre strip: Tasks · Calendar · Records.
 */
export default function TasksWorkbenchPage() {
  return <Dashboard workbenchPanel="workspace" defaultCentreTab="tasks" />;
}
