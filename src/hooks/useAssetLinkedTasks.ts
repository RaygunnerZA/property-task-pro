import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export type AssetLinkedTaskRow = {
  taskId: string;
  taskTitle: string;
  dueDate: string | null;
  createdAt: string | null;
  assignedUserId: string | null;
  assetId: string;
  assetName: string;
  assetIconName: string | null;
  assetImageUrl: string | null;
};

/**
 * Open-ish tasks linked to the given assets (Attention + property rail).
 * Emits one row per task↔asset link so multi-asset tasks appear on each asset.
 */
export function useAssetLinkedTasks(assetIds: string[]) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const idsKey = assetIds.slice().sort().join(",");

  return useQuery({
    queryKey: ["asset-linked-tasks", orgId, idsKey],
    queryFn: async (): Promise<AssetLinkedTaskRow[]> => {
      if (!orgId || assetIds.length === 0) return [];

      const { data: links, error: linkErr } = await supabase
        .from("task_assets")
        .select("task_id, asset_id")
        .in("asset_id", assetIds);

      if (linkErr) throw linkErr;
      const taskIds = [...new Set((links ?? []).map((l) => l.task_id).filter(Boolean))];
      if (taskIds.length === 0) return [];

      const [{ data: tasks, error: tasksErr }, { data: assets, error: assetsErr }] =
        await Promise.all([
          supabase
            .from("tasks")
            .select("id, title, assigned_user_id, due_at, created_at, status")
            .eq("org_id", orgId)
            .in("id", taskIds)
            .order("created_at", { ascending: false }),
          supabase.from("assets").select("id, name, icon_name").in("id", assetIds),
        ]);

      if (tasksErr) throw tasksErr;
      if (assetsErr) throw assetsErr;

      const assetById = new Map((assets ?? []).map((a) => [a.id, a]));
      const taskById = new Map((tasks ?? []).map((t) => [t.id, t]));

      const imageByAsset = new Map<string, string>();
      const { data: files } = await supabase
        .from("asset_files")
        .select("asset_id, file_url, thumbnail_url, file_type")
        .in("asset_id", assetIds)
        .limit(80);
      for (const file of files ?? []) {
        if (imageByAsset.has(file.asset_id)) continue;
        const t = (file.file_type || "").toLowerCase();
        const url = file.thumbnail_url || file.file_url;
        if (!url) continue;
        if (t.startsWith("image/") || t === "photo" || t === "image" || /\.(png|jpe?g|webp|gif)$/i.test(url)) {
          imageByAsset.set(file.asset_id, url);
        }
      }

      const rows: AssetLinkedTaskRow[] = [];
      for (const link of links ?? []) {
        const task = taskById.get(link.task_id);
        if (!task) continue;
        if (task.status === "completed" || task.status === "archived") continue;
        const asset = assetById.get(link.asset_id);
        rows.push({
          taskId: task.id,
          taskTitle: task.title || "Untitled task",
          dueDate: task.due_at,
          createdAt: task.created_at,
          assignedUserId: task.assigned_user_id,
          assetId: link.asset_id,
          assetName: asset?.name || "Asset",
          assetIconName: asset?.icon_name ?? null,
          assetImageUrl: imageByAsset.get(link.asset_id) ?? null,
        });
      }

      rows.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      return rows;
    },
    enabled: !!orgId && !orgLoading && assetIds.length > 0,
    staleTime: 30_000,
  });
}
