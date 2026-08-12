import { useMemo } from "react";
import { TasksMessagesPeopleList } from "@/components/workbench/TasksMessagesPeopleList";
import { useTaskMessageActivity } from "@/hooks/useTaskMessageActivity";
import { useIdentityMode } from "@/hooks/useIdentityMode";
import { taskMatchesPropertyScope } from "@/utils/propertyFilter";
import {
  isOnboardingDemoTask,
  shouldHideOwnerDemoTaskForRole,
} from "@/lib/onboardingEducation";
import { isStaffTrainingTask } from "@/lib/staffTraining";

const TERMINAL_TASK_STATUSES = new Set(["completed", "archived", "done"]);

type TasksMessagesThirdColumnListProps = {
  tasks: any[];
  properties: { id: string }[];
  selectedPropertyIds?: Set<string>;
};

/**
 * WhatsApp-like conversations list for the third column (below Add to Filla)
 * while the Tasks → Messages tab is active.
 */
export function TasksMessagesThirdColumnList({
  tasks,
  properties,
  selectedPropertyIds,
}: TasksMessagesThirdColumnListProps) {
  const { mode: identityMode } = useIdentityMode();
  const memberRole =
    identityMode === "manager" ? "manager" : identityMode === "staff" ? "staff" : "owner";
  const { personThreads } = useTaskMessageActivity();

  const openTaskIds = useMemo(() => {
    const propertyIds = properties.map((p) => p.id);
    const ids = new Set<string>();
    for (const task of tasks) {
      const status = String(task.status ?? "").toLowerCase();
      if (TERMINAL_TASK_STATUSES.has(status)) continue;
      if (!taskMatchesPropertyScope(task, selectedPropertyIds, propertyIds)) continue;
      if (shouldHideOwnerDemoTaskForRole(task, memberRole)) continue;
      if (isStaffTrainingTask(task)) continue;
      const isDemo = isOnboardingDemoTask(task);
      if (isDemo && memberRole !== "owner" && memberRole !== "manager") continue;
      ids.add(String(task.id));
    }
    return ids;
  }, [tasks, properties, selectedPropertyIds, memberRole]);

  const taskTitlesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const task of tasks) {
      const id = String(task.id);
      if (!openTaskIds.has(id)) continue;
      map[id] = String(task.title ?? "Task");
    }
    return map;
  }, [tasks, openTaskIds]);

  const scopedThreads = useMemo(
    () =>
      personThreads
        .map((thread) => ({
          ...thread,
          taskPreviews: thread.taskPreviews.filter((p) => openTaskIds.has(p.taskId)),
        }))
        .filter((thread) => thread.taskPreviews.length > 0),
    [personThreads, openTaskIds]
  );

  const handleSelectTask = (taskId: string) => {
    window.dispatchEvent(
      new CustomEvent("filla:open-task-from-messages", { detail: { taskId } })
    );
  };

  return (
    <TasksMessagesPeopleList
      threads={scopedThreads}
      taskTitlesById={taskTitlesById}
      onSelectTask={handleSelectTask}
      className="px-0.5"
    />
  );
}
