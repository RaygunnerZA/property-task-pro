import Dashboard from "@/app/page";

/**
 * Mobile / dedicated work-surface route for the centre column.
 * Same Dashboard tree as home; {@link resolveWorkbenchLayout} treats `/tasks`
 * as `work-surface` so phone shows Inflow · Tasks · Calendar instead of
 * collapsing to scope-only home-hub.
 */
export default function TasksWorkbenchPage() {
  return <Dashboard workbenchPanel="home" defaultCentreTab="tasks" />;
}
