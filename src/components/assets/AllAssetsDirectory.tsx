import { useMemo, useState, type CSSProperties } from "react";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import {
  ONBOARDING_ASSET_GROUPS,
  getAssetGroupById,
  getGroupIdFromAssetType,
} from "@/components/onboarding/onboardingAssetGroups";
import { loadPropertyCustomAssetGroups } from "@/lib/propertyCustomAssetGroupsStorage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type AssetViewRow = Tables<"assets_view">;

export type AllAssetsSort =
  | "name-asc"
  | "name-desc"
  | "group"
  | "recent"
  | "open-tasks";

const SORT_OPTIONS: { id: AllAssetsSort; label: string }[] = [
  { id: "name-asc", label: "A–Z" },
  { id: "name-desc", label: "Z–A" },
  { id: "group", label: "By group" },
  { id: "recent", label: "Recently updated" },
  { id: "open-tasks", label: "Open tasks first" },
];

const GROUP_ORDER = new Map(
  ONBOARDING_ASSET_GROUPS.map((g, index) => [g.id, index])
);

const COLUMN_STYLE: CSSProperties = {
  columnGap: "2.75rem",
  columnRule: "1px solid hsl(var(--border) / 0.35)",
};

type AllAssetsDirectoryProps = {
  propertyId: string;
  assetFilter?: string;
  onAssetClick?: (assetId: string) => void;
  className?: string;
};

function assetNameRaw(asset: AssetViewRow): string {
  return (asset.name ?? "").trim() || "Unnamed";
}

function compareNameAsc(a: AssetViewRow, b: AssetViewRow): number {
  return assetNameRaw(a).localeCompare(assetNameRaw(b), undefined, { sensitivity: "base" });
}

function groupIdForAsset(
  asset: AssetViewRow,
  assetToCollection: Record<string, string>
): string | undefined {
  const nameKey = (asset.name ?? "").toLowerCase().trim();
  if (nameKey && assetToCollection[nameKey]) {
    return assetToCollection[nameKey];
  }
  if (asset.asset_type) {
    const fromType = getGroupIdFromAssetType(asset.asset_type);
    if (fromType) return fromType;
  }
  const name = asset.name?.trim();
  if (!name) return undefined;
  const matching = ONBOARDING_ASSET_GROUPS.filter((g) =>
    g.suggestedAssets.some((s) => s.toLowerCase() === name.toLowerCase())
  );
  return matching.length === 1 ? matching[0].id : undefined;
}

function groupLabelForAsset(
  asset: AssetViewRow,
  assetToCollection: Record<string, string>
): string {
  const id = groupIdForAsset(asset, assetToCollection);
  if (!id) return "Ungrouped";
  const predefined = getAssetGroupById(id);
  if (predefined) return predefined.label;
  const custom = loadPropertyCustomAssetGroups(asset.property_id ?? "").collections.find(
    (c) => c.id === id
  );
  return custom?.name ?? "Ungrouped";
}

function sortAssets(
  assets: AssetViewRow[],
  sort: AllAssetsSort,
  assetToCollection: Record<string, string>
): AssetViewRow[] {
  const list = [...assets];

  switch (sort) {
    case "name-desc":
      return list.sort((a, b) => compareNameAsc(b, a));
    case "group":
      return list.sort((a, b) => {
        const aId = groupIdForAsset(a, assetToCollection);
        const bId = groupIdForAsset(b, assetToCollection);
        const aOrder = aId != null ? (GROUP_ORDER.get(aId) ?? 999) : 1000;
        const bOrder = bId != null ? (GROUP_ORDER.get(bId) ?? 999) : 1000;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return compareNameAsc(a, b);
      });
    case "recent":
      return list.sort((a, b) => {
        const aDate = new Date((a as AssetViewRow & { updated_at?: string }).updated_at ?? 0).getTime();
        const bDate = new Date((b as AssetViewRow & { updated_at?: string }).updated_at ?? 0).getTime();
        if (bDate !== aDate) return bDate - aDate;
        return compareNameAsc(a, b);
      });
    case "open-tasks":
      return list.sort((a, b) => {
        const aTasks = a.open_tasks_count ?? 0;
        const bTasks = b.open_tasks_count ?? 0;
        if (bTasks !== aTasks) return bTasks - aTasks;
        return compareNameAsc(a, b);
      });
    case "name-asc":
    default:
      return list.sort(compareNameAsc);
  }
}

export function AllAssetsDirectory({
  propertyId,
  assetFilter = "",
  onAssetClick,
  className,
}: AllAssetsDirectoryProps) {
  const { data: assets = [], isLoading: loading } = useAssetsQuery(propertyId);
  const [sort, setSort] = useState<AllAssetsSort>("name-asc");
  const assetToCollection = useMemo(
    () => loadPropertyCustomAssetGroups(propertyId).assetToCollection,
    [propertyId]
  );

  const filtered = useMemo(() => {
    const q = assetFilter.trim().toLowerCase();
    if (!q) return assets as AssetViewRow[];
    return (assets as AssetViewRow[]).filter((a) =>
      assetNameRaw(a).toLowerCase().includes(q)
    );
  }, [assets, assetFilter]);

  const sorted = useMemo(
    () => sortAssets(filtered, sort, assetToCollection),
    [filtered, sort, assetToCollection]
  );

  const groupSections = useMemo(() => {
    if (sort !== "group") return null;
    const sections: { key: string; label: string; assets: AssetViewRow[] }[] = [];
    for (const asset of sorted) {
      const label = groupLabelForAsset(asset, assetToCollection);
      const last = sections[sections.length - 1];
      if (last && last.label === label) {
        last.assets.push(asset);
      } else {
        sections.push({
          key: groupIdForAsset(asset, assetToCollection) ?? "ungrouped",
          label,
          assets: [asset],
        });
      }
    }
    return sections;
  }, [sorted, sort, assetToCollection]);

  const renderLink = (asset: AssetViewRow) => {
    const name = assetNameRaw(asset);
    const taskCount = asset.open_tasks_count ?? 0;
    const hasOpen = taskCount > 0;
    return (
      <li key={asset.id} className="break-inside-avoid">
        <button
          type="button"
          onClick={() => asset.id && onAssetClick?.(asset.id)}
          className={cn(
            "flex w-full items-baseline gap-2 py-0.5 text-left text-xs leading-snug",
            "transition-colors hover:text-primary focus-visible:outline-none focus-visible:text-primary",
            hasOpen ? "font-medium text-foreground" : "text-foreground/90"
          )}
          title={taskCount > 0 ? `${name} · ${taskCount} open task${taskCount === 1 ? "" : "s"}` : name}
        >
          <span className="min-w-0 flex-1 truncate">{name}</span>
          {taskCount > 0 ? (
            <span className="shrink-0 tabular-nums text-caption text-muted-foreground">
              {taskCount}
            </span>
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <section className={cn("space-y-3", className)} aria-labelledby="all-assets-heading">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="rounded-lg bg-primary/15 p-1.5"
            aria-hidden
          >
            <span className="block h-4 w-4 rounded-sm bg-primary/40" />
          </div>
          <h2
            id="all-assets-heading"
            className="text-sm font-semibold text-foreground"
          >
            All assets
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            ({sorted.length})
          </span>
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as AllAssetsSort)}>
          <SelectTrigger className="h-8 w-[140px] border-0 bg-card/60 text-xs shadow-e1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4">Loading assets…</p>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">
          {assetFilter.trim() ? "No assets match your search." : "No assets yet."}
        </p>
      ) : sort === "group" && groupSections ? (
        <div className="space-y-4">
          {groupSections.map((section) => (
            <div key={section.key}>
              <h3 className="mb-1.5 text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                {section.label}
              </h3>
              <ul className="columns-2 sm:columns-3 lg:columns-4" style={COLUMN_STYLE}>
                {section.assets.map(renderLink)}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="columns-2 sm:columns-3 lg:columns-4" style={COLUMN_STYLE}>
          {sorted.map(renderLink)}
        </ul>
      )}
    </section>
  );
}
