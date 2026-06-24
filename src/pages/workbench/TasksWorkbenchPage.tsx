import Dashboard from "@/app/page";

/**
 * Mobile Tasks route — opens the centre work column (Tasks tab by default).
 */
export default function TasksWorkbenchPage() {
  return <Dashboard workbenchPanel="home" defaultCentreTab="tasks" />;
}
