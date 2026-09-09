import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { updateTaskFields } from "@/services/tasks/taskMutations";
import {
  isTaskPhotoAttachment,
  missingTaskCaptureFields,
  parseTaskCaptureRequirements,
  taskCaptureRequiredMessage,
} from "@/lib/taskCaptureRequirements";

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

/** Blocks complete when org capture requirements are missing. Database trigger is the authority. */
export async function assertTaskReadyToComplete(taskId: string): Promise<void> {
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, org_id, property_id, space_ids, image_url")
    .eq("id", taskId)
    .maybeSingle();
  if (taskError) throw taskError;
  if (!task?.org_id) {
    throw new Error("Couldn't find that task.");
  }

  const { data: settings, error: settingsError } = await supabase
    .from("org_settings")
    .select("require_task_photo, require_task_location, require_task_category")
    .eq("org_id", task.org_id)
    .maybeSingle();
  if (settingsError) {
    return;
  }

  const requirements = parseTaskCaptureRequirements(settings);
  if (
    !requirements.requirePhoto &&
    !requirements.requireLocation &&
    !requirements.requireCategory
  ) {
    return;
  }

  const [spacesRes, themesRes, attachRes] = await Promise.all([
    supabase
      .from("task_spaces")
      .select("space_id", { count: "exact", head: true })
      .eq("task_id", taskId),
    supabase
      .from("task_themes")
      .select("theme_id", { count: "exact", head: true })
      .eq("task_id", taskId),
    supabase
      .from("attachments")
      .select("file_type, file_name, file_url, thumbnail_url, metadata")
      .eq("parent_id", taskId)
      .eq("parent_type", "task")
      .eq("org_id", task.org_id),
  ]);

  if (requirements.requireLocation && spacesRes.error) throw spacesRes.error;
  if (requirements.requireCategory && themesRes.error) throw themesRes.error;
  if (requirements.requirePhoto && attachRes.error && !task.image_url) throw attachRes.error;

  const spaceIds = Array.isArray(task.space_ids) ? task.space_ids : [];
  const missing = missingTaskCaptureFields(requirements, {
    hasPhoto:
      Boolean(task.image_url) ||
      (attachRes.data ?? []).some((row) => isTaskPhotoAttachment(row)),
    hasLocation:
      Boolean(task.property_id) && (spaceIds.length > 0 || (spacesRes.count ?? 0) > 0),
    hasCategory: (themesRes.count ?? 0) > 0,
  });
  if (missing.length > 0) {
    throw new Error(taskCaptureRequiredMessage(missing, "complete"));
  }
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
    /** Caller already ran assertTaskReadyToComplete. */
    skipCaptureCheck?: boolean;
  }
): Promise<void> {
  const optimistic = options?.optimistic === true;
  const skipCachePatch = options?.skipCachePatch === true;

  if (optimistic && !skipCachePatch) {
    patchTasksCacheStatus(queryClient, taskId, "completed");
  }

  try {
    if (!options?.skipCaptureCheck) {
      await assertTaskReadyToComplete(taskId);
    }
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
