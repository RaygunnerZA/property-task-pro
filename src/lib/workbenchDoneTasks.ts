import { format } from "date-fns";
import { mapTask } from "@/utils/mapTask";
import { resolveTaskDisplayImageUrl } from "@/lib/taskIllustration";

const DONE_PREVIEW_LIMIT = 6;

export type WorkbenchDoneTaskPreview = {
  id: string;
  title: string;
  metaLine: string;
  thumbnailUrl: string;
};

/**
 * Completed tasks for Issues "Done" stream (property scope + search, max 6 recent).
 */
export function pickDoneWorkbenchTaskPreviews(
  tasks: unknown[] | undefined,
  options: {
    properties: { id: string; name?: string | null; nickname?: string | null; address?: string | null }[];
    selectedPropertyIds?: Set<string>;
    searchQuery?: string;
  }
): { previews: WorkbenchDoneTaskPreview[]; totalCount: number } {
  const { properties, selectedPropertyIds, searchQuery = "" } = options;
  const propertyMap = new Map(properties.map((p) => [p.id, p]));

  let filtered = (tasks ?? []).filter(
    (task: { status?: string }) => String(task?.status ?? "").toLowerCase() === "completed"
  );

  if (selectedPropertyIds && selectedPropertyIds.size > 0 && selectedPropertyIds.size < properties.length) {
    filtered = filtered.filter(
      (task: { property_id?: string }) =>
        task.property_id && selectedPropertyIds.has(task.property_id)
    );
  }

  const q = searchQuery.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((task: { title?: string; description?: string; property_id?: string }) => {
      const title = String(task.title ?? "").toLowerCase();
      const desc = String(task.description ?? "").toLowerCase();
      const prop = task.property_id
        ? String(
            propertyMap.get(task.property_id)?.nickname ||
              propertyMap.get(task.property_id)?.name ||
              propertyMap.get(task.property_id)?.address ||
              ""
          ).toLowerCase()
        : "";
      return title.includes(q) || desc.includes(q) || prop.includes(q);
    });
  }

  const sorted = [...filtered].sort((a, b) => {
    const tb = new Date(
      (b as { updated_at?: string; created_at?: string }).updated_at ||
        (b as { created_at?: string }).created_at ||
        0
    ).getTime();
    const ta = new Date(
      (a as { updated_at?: string; created_at?: string }).updated_at ||
        (a as { created_at?: string }).created_at ||
        0
    ).getTime();
    return tb - ta;
  });

  const totalCount = sorted.length;
  const previews = sorted.slice(0, DONE_PREVIEW_LIMIT).map((task) => {
    const mapped = mapTask(task as Parameters<typeof mapTask>[0]);
    const property = (task as { property_id?: string }).property_id
      ? propertyMap.get((task as { property_id: string }).property_id)
      : undefined;
    const propertyLabel =
      property?.nickname || property?.name || property?.address || "Property";
    const completedAt =
      (task as { updated_at?: string; created_at?: string }).updated_at ||
      (task as { created_at?: string }).created_at;
    const when = completedAt
      ? format(new Date(completedAt), "d MMM")
      : "Recently";
    return {
      id: mapped.id,
      title: mapped.title,
      metaLine: `${propertyLabel} • Completed ${when}`,
      thumbnailUrl: resolveTaskDisplayImageUrl(task as Record<string, unknown>, mapped.title),
    };
  });

  return { previews, totalCount };
}
