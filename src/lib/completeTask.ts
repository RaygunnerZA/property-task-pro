import type { QueryClient } from "@tanstack/react-query";
import { updateTaskFields } from "@/services/tasks/taskMutations";

const TERMINAL = new Set(["completed", "archived", "done"]);

export function isTerminalTaskStatus(status: string | null | undefined): boolean {
  return TERMINAL.has(String(status ?? "").toLowerCase());
}

/** Patch every cached tasks list with a new status for one task. */
export function patchTasksCacheStatus(
  queryClient: QueryClient,
  taskId: string,
  status: string
): void {
  queryClient.setQueriesData({ queryKey: ["tasks"] }, (old: unknown) => {
    if (!Array.isArray(old)) return old;
    return old.map((row: { id?: string | null; status?: string | null }) =>
      row?.id === taskId ? { ...row, status } : row
    );
  });
}

export async function invalidateAfterTaskCompleted(
  queryClient: QueryClient,
  taskId: string,
  orgId?: string | null
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["tasks"] }),
    queryClient.invalidateQueries({ queryKey: ["tasks-briefing"] }),
    orgId
      ? queryClient.invalidateQueries({ queryKey: ["task", orgId, taskId] })
      : queryClient.invalidateQueries({ queryKey: ["task", taskId] }),
  ]);
}

/**
 * Mark a task completed (constitutional status — not `archived`, which means cancelled).
 *
 * By default patches list caches to `completed` so All keeps the row visible in place.
 * Pass `optimistic: true` only when the caller wants an open-only surface to drop it.
 * Pass `skipCachePatch: true` when the caller invalidates after UI motion.
 */
export async function markTaskCompleted(
  queryClient: QueryClient,
  taskId: string,
  options?: {
    orgId?: string | null;
    optimistic?: boolean;
    /** When true, skip cache patch entirely (caller invalidates after UI motion). */
    skipCachePatch?: boolean;
  }
): Promise<void> {
  const optimistic = options?.optimistic === true;
  const skipCachePatch = options?.skipCachePatch === true;

  if (optimistic && !skipCachePatch) {
    patchTasksCacheStatus(queryClient, taskId, "completed");
  }

  try {
    await updateTaskFields(taskId, { status: "completed" });
  } catch (err) {
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    throw err;
  }

  if (!skipCachePatch && !optimistic) {
    // Soft status update — All keeps the row; open-only lists drop it via filters.
    patchTasksCacheStatus(queryClient, taskId, "completed");
  }

  if (!skipCachePatch) {
    await invalidateAfterTaskCompleted(queryClient, taskId, options?.orgId);
  }
}
