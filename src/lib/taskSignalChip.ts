import { getTaskDueUrgency } from "@/lib/taskDueUrgency";

/**
 * Single thumbnail / hero signal chip — merges priority + due urgency.
 *
 * Precedence (highest first):
 * 1. EXPIRED — validity / compliance past end (when caller supplies `expired`)
 * 2. OVERDUE — due date before today
 * 3. URGENT — priority flag (wins over due-soon; loses to overdue)
 * 4. DUE SOON — due within 7 days
 *
 * One chip only: schedule breach beats priority; priority beats soft due-soon.
 */
export type TaskSignalChipKind = "expired" | "overdue" | "urgent" | "due_soon";

export type TaskSignalChipTone = "coral" | "amber";

export type TaskSignalChip = {
  kind: TaskSignalChipKind;
  label: string;
  tone: TaskSignalChipTone;
};

const TERMINAL_STATUSES = new Set(["completed", "archived"]);

export function resolveTaskSignalChip(input: {
  priority?: string | null;
  due_date?: string | null;
  status?: string | null;
  /** Explicit expiry (e.g. compliance validity). Not inferred from due date. */
  expired?: boolean | null;
}): TaskSignalChip | null {
  const status = (input.status ?? "").toLowerCase();
  if (TERMINAL_STATUSES.has(status)) return null;

  if (input.expired) {
    return { kind: "expired", label: "EXPIRED", tone: "coral" };
  }

  const due = getTaskDueUrgency(input);
  if (due === "overdue") {
    return { kind: "overdue", label: "OVERDUE", tone: "coral" };
  }

  const urgent = (input.priority ?? "").toLowerCase() === "urgent";
  if (urgent) {
    return { kind: "urgent", label: "URGENT", tone: "coral" };
  }

  if (due === "due_soon") {
    return { kind: "due_soon", label: "DUE SOON", tone: "amber" };
  }

  return null;
}
