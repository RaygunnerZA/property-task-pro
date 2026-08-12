/** Broadcast when the Tasks workbench Messages list tab is active (collapses composer chrome). */

export const TASKS_MESSAGES_TAB_EVENT = "filla:tasks-messages-tab";

export function setTasksMessagesTabActive(active: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(TASKS_MESSAGES_TAB_EVENT, { detail: { active: Boolean(active) } })
  );
}

export function isTasksMessagesTabEvent(
  event: Event
): event is CustomEvent<{ active?: boolean }> {
  return event.type === TASKS_MESSAGES_TAB_EVENT;
}
