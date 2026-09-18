import { supabase } from "@/integrations/supabase/client";

/**
 * Sync a task↔entity junction table by diff (add missing, remove extras).
 * Safer than delete-all + insert-all when RLS delete is missing or races occur.
 *
 * For `task_spaces`, also mirrors into `tasks.space_ids` — `tasks_view.spaces`
 * is built from that array, not the junction (@Docs / capture requirements).
 */
export async function syncTaskJunctionIds(args: {
  table: "task_spaces" | "task_assets" | "task_themes";
  taskId: string;
  idColumn: "space_id" | "asset_id" | "theme_id";
  desiredIds: string[];
}): Promise<void> {
  const { table, taskId, idColumn } = args;
  const desired = [
    ...new Set(args.desiredIds.filter((id) => Boolean(id) && !id.startsWith("ghost-"))),
  ];

  const { data: existingRows, error: fetchError } = await supabase
    .from(table)
    .select(idColumn)
    .eq("task_id", taskId);
  if (fetchError) throw fetchError;

  const existing = new Set(
    ((existingRows ?? []) as Array<Record<string, string>>).map((row) => row[idColumn]).filter(Boolean)
  );
  const desiredSet = new Set(desired);

  const toRemove = [...existing].filter((id) => !desiredSet.has(id));
  const toAdd = desired.filter((id) => !existing.has(id));

  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq("task_id", taskId)
      .in(idColumn, toRemove);
    if (deleteError) throw deleteError;
  }

  if (toAdd.length > 0) {
    const { error: insertError } = await supabase
      .from(table)
      .insert(toAdd.map((id) => ({ task_id: taskId, [idColumn]: id })));
    if (insertError) throw insertError;
  }

  if (table === "task_spaces") {
    const { error: spaceIdsError } = await supabase
      .from("tasks")
      .update({ space_ids: desired })
      .eq("id", taskId);
    if (spaceIdsError) throw spaceIdsError;
  }
}
