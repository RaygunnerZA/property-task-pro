/**
 * Task priority — DB check `tasks_priority_check`:
 * low | medium | high | urgent
 *
 * UI label "NORMAL" maps to DB value `medium` (legacy UI used `normal`).
 */

export type TaskPriorityDb = "low" | "medium" | "high" | "urgent";

export function toTaskPriorityDb(value: string | null | undefined): TaskPriorityDb {
  const v = (value ?? "medium").toLowerCase().trim();
  if (v === "normal") return "medium";
  if (v === "low" || v === "medium" || v === "high" || v === "urgent") return v;
  return "medium";
}

export function taskPriorityLabel(value: string | null | undefined): string {
  const db = toTaskPriorityDb(value);
  return (
    {
      low: "LOW",
      medium: "NORMAL",
      high: "HIGH",
      urgent: "URGENT",
    } as const
  )[db];
}
