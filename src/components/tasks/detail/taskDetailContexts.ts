/** V2.1 task detail contexts — @Docs/05_Task_Engine.md §5.6, Appendix_A TASK */

export const TASK_DETAIL_CONTEXTS = [
  { id: "overview", label: "Overview" },
  { id: "checklist", label: "Checklist" },
  { id: "evidence", label: "Evidence" },
  { id: "activity", label: "Activity" },
] as const;

export type TaskDetailContextId = (typeof TASK_DETAIL_CONTEXTS)[number]["id"];

export const DEFAULT_TASK_DETAIL_CONTEXT: TaskDetailContextId = "overview";
