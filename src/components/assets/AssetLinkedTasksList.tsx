import { format } from "date-fns";
import { getAssetIcon } from "@/lib/icon-resolver";
import { useAssetLinkedTasks } from "@/hooks/useAssetLinkedTasks";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { cn } from "@/lib/utils";

type AssetLinkedTasksListProps = {
  assetIds: string[];
  onOpenAsset?: (assetId: string) => void;
};

export function AssetLinkedTasksList({ assetIds, onOpenAsset }: AssetLinkedTasksListProps) {
  const { data: rows = [], isLoading } = useAssetLinkedTasks(assetIds);
  const { members } = useOrgMembers();

  if (isLoading && rows.length === 0) {
    return <p className="px-1 text-2xs text-muted-foreground/70">Loading linked tasks…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="px-1 text-2xs leading-relaxed text-muted-foreground/70">
        No tasks linked to assets yet.
      </p>
    );
  }

  return (
    <ul className="min-w-0">
      {rows.map((row, index) => {
        const Icon = getAssetIcon(row.assetIconName);
        const member = members.find((m) => m.user_id === row.assignedUserId);
        const assigner =
          member?.display_name || member?.nickname || member?.first_name || "Unassigned";
        const dateRaw = row.dueDate || row.createdAt;
        const dateLabel = dateRaw ? format(new Date(dateRaw), "d MMM") : null;

        return (
          <li key={row.taskId}>
            {index > 0 ? (
              <div className="mx-1 border-t border-dashed border-border/45" aria-hidden />
            ) : null}
            <button
              type="button"
              onClick={() => row.assetId && onOpenAsset?.(row.assetId)}
              className={cn(
                "flex w-full min-w-0 items-start gap-2 rounded-lg px-1 py-2 text-left",
                "transition-colors hover:bg-muted/30",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
              )}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 overflow-hidden rounded-card bg-muted/50 shadow-e1">
                {row.assetImageUrl ? (
                  <img src={row.assetImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">
                  {row.assetName}
                </span>
                <span className="mt-0.5 block truncate text-2xs text-muted-foreground">
                  {row.taskTitle}
                </span>
                <span className="mt-0.5 block truncate text-2xs text-muted-foreground/70">
                  {assigner}
                  {dateLabel ? ` · ${dateLabel}` : ""}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
