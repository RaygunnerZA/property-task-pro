/**
 * Loads TaskDetailPanel only when a task is selected.
 * Keeps the ~100KB+ panel (and its create/annotation deps) out of the workbench first paint.
 */
import { lazy, Suspense } from "react";
import type { TaskDetailPanelProps } from "@/components/tasks/TaskDetailPanel";

const TaskDetailPanelLazy = lazy(() =>
  import("@/components/tasks/TaskDetailPanel").then((m) => ({ default: m.TaskDetailPanel }))
);

export function LazyTaskDetailPanel(props: TaskDetailPanelProps) {
  return (
    <Suspense fallback={null}>
      <TaskDetailPanelLazy {...props} />
    </Suspense>
  );
}
