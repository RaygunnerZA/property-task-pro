import type { LucideIcon } from "lucide-react";
import {
  Circle,
  CircleCheckBig,
  CirclePause,
  CircleX,
  Loader2,
} from "lucide-react";
import type { TaskStatus } from "@/types/database";

/**
 * Task status display — maps DB `task_status` to labels, icons, and block fills.
 *
 * DB (constitutional): open | in_progress | waiting_review | completed | archived
 * UI labels: Not started | In progress | On hold | Completed | Cancelled
 */
export type TaskStatusVisual = {
  status: TaskStatus;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
  /** Solid block behind the icon (task thumbnail). */
  blockClassName: string;
  /** Icon color on the block (usually white). */
  iconClassName: string;
  /** Filter / strip control colors when idle. */
  filterIconClassName: string;
  filterId: string;
};

export const TASK_STATUS_VISUALS: Record<TaskStatus, TaskStatusVisual> = {
  open: {
    status: "open",
    label: "Not started",
    shortLabel: "Not started",
    Icon: Circle,
    // Lighter grey block; circle stroke grey with white fill.
    blockClassName: "bg-muted-foreground/30",
    iconClassName: "text-muted-foreground/55 fill-white",
    filterIconClassName: "text-muted-foreground/55 fill-white",
    filterId: "filter-status-todo",
  },
  in_progress: {
    status: "in_progress",
    label: "In progress",
    shortLabel: "In progress",
    Icon: Loader2,
    blockClassName: "bg-blue-500",
    iconClassName: "text-white",
    filterIconClassName: "text-blue-500",
    filterId: "filter-status-in-progress",
  },
  waiting_review: {
    status: "waiting_review",
    label: "On hold",
    shortLabel: "On hold",
    Icon: CirclePause,
    blockClassName: "bg-amber-500",
    iconClassName: "text-white",
    filterIconClassName: "text-amber-500",
    filterId: "filter-status-waiting-review",
  },
  completed: {
    status: "completed",
    label: "Completed",
    shortLabel: "Completed",
    Icon: CircleCheckBig,
    blockClassName: "bg-success-vivid",
    iconClassName: "text-white",
    filterIconClassName: "text-success-vivid",
    filterId: "filter-status-done",
  },
  archived: {
    status: "archived",
    label: "Cancelled",
    shortLabel: "Cancelled",
    Icon: CircleX,
    blockClassName: "bg-muted-foreground",
    iconClassName: "text-white",
    filterIconClassName: "text-muted-foreground",
    filterId: "filter-status-cancelled",
  },
};

/** Ordered for filter strips and Status menus. */
export const TASK_STATUS_ORDER: TaskStatus[] = [
  "open",
  "in_progress",
  "waiting_review",
  "completed",
  "archived",
];

export const TASK_STATUS_FILTER_IDS = TASK_STATUS_ORDER.map(
  (s) => TASK_STATUS_VISUALS[s].filterId
);

export function getTaskStatusVisual(
  status: string | null | undefined
): TaskStatusVisual {
  if (status && status in TASK_STATUS_VISUALS) {
    return TASK_STATUS_VISUALS[status as TaskStatus];
  }
  return TASK_STATUS_VISUALS.open;
}

/** Whether a task matches any selected status filter ids. */
export function taskMatchesStatusFilters(
  taskStatus: string | null | undefined,
  selectedFilters: Set<string> | ReadonlySet<string>
): boolean {
  const hasAny = TASK_STATUS_FILTER_IDS.some((id) => selectedFilters.has(id));
  if (!hasAny) return true;
  const visual = getTaskStatusVisual(taskStatus);
  return selectedFilters.has(visual.filterId);
}
