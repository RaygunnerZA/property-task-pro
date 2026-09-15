import { useMemo, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAdminSeasonalPackages,
  type AdminSeasonalPackageListRow,
} from "@/hooks/admin/useAdminSeasonalPackages";
import {
  audienceLabel,
  deriveSeasonalReleaseState,
  primarySeasonalAction,
  type SeasonalDerivedReleaseState,
} from "@/lib/seasonal/seasonalPackageRelease";
import { AdminSeasonalPackageWorkspace } from "@/components/admin/AdminSeasonalPackageWorkspace";

const FILTERS: { id: SeasonalDerivedReleaseState | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "needs_content", label: "Needs content" },
  { id: "needs_creative", label: "Needs creative" },
  { id: "ready_for_review", label: "Ready for review" },
  { id: "scheduled", label: "Scheduled" },
  { id: "live", label: "Live" },
  { id: "archived", label: "Archived" },
];

function derivedLabel(state: SeasonalDerivedReleaseState): string {
  switch (state) {
    case "needs_content":
      return "Needs content";
    case "needs_creative":
      return "Needs creative";
    case "ready_for_review":
      return "Ready for review";
    case "scheduled":
      return "Scheduled";
    case "live":
      return "Live";
    case "ended":
      return "Ended";
    case "archived":
      return "Archived";
    default:
      return "Draft";
  }
}

function creativeLabel(row: AdminSeasonalPackageListRow): string {
  const status = row.creative?.status ?? "missing";
  if (status === "approved") return "Approved";
  if (status === "draft") return "Draft";
  return "Missing";
}

function contentLabel(row: AdminSeasonalPackageListRow): string {
  const total = row.item_count ?? 0;
  const ready = row.items_ready_count ?? 0;
  if (total === 0) return "0 items";
  if (ready >= total) return "Ready";
  return `${ready}/${total} ready`;
}

export function AdminSeasonalPackagesPanel() {
  const listQuery = useAdminSeasonalPackages();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const list = listQuery.data ?? [];
    return list.map((row) => {
      const derived = deriveSeasonalReleaseState(row);
      const action = primarySeasonalAction(derived, row.display_from);
      return { row, derived, action };
    });
  }, [listQuery.data]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "draft") {
      return rows.filter((r) =>
        ["draft", "needs_content", "needs_creative", "ready_for_review"].includes(r.derived)
      );
    }
    return rows.filter((r) => r.derived === filter);
  }, [filter, rows]);

  if (selectedId || creating) {
    return (
      <AdminSeasonalPackageWorkspace
        packageId={creating ? null : selectedId}
        onBack={() => {
          setSelectedId(null);
          setCreating(false);
        }}
        onSaved={(id) => {
          setCreating(false);
          setSelectedId(id);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Seasonal packages
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Editorial distribution over published Knowledge — approve packages separately from
            Publish Knowledge.
          </p>
        </div>
        <Button
          size="sm"
          className="shadow-primary-btn border-0"
          onClick={() => setCreating(true)}
        >
          New package
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? "default" : "outline"}
            className={cn(
              "h-8 border-0 text-xs",
              filter === f.id ? "shadow-primary-btn" : "btn-neomorphic"
            )}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {listQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : null}

      {listQuery.error ? (
        <p className="text-sm text-destructive">
          {listQuery.error instanceof Error
            ? listQuery.error.message
            : "Failed to load packages"}
        </p>
      ) : null}

      {!listQuery.isLoading && filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No packages match this filter.</p>
      ) : null}

      <div className="space-y-2">
        {filtered.map(({ row, derived, action }) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setSelectedId(row.id)}
            className="w-full text-left rounded-xl bg-card/80 shadow-e1 p-3 space-y-2 hover:bg-card transition-colors"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground">{row.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {row.season} · {audienceLabel(row.applicability)} · {row.display_from} →{" "}
                  {row.display_until}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-muted/50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {derivedLabel(derived)}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                Knowledge {row.items_ready_count}/{row.item_count}
              </span>
              <span>Content {contentLabel(row)}</span>
              <span>Creative {creativeLabel(row)}</span>
              <span>
                Surfaces{" "}
                {(row.surfaces ?? []).length > 0 ? (row.surfaces ?? []).join(", ") : "—"}
              </span>
            </div>
            <p className="text-xs font-medium text-primary">{action.label} →</p>
          </button>
        ))}
      </div>
    </div>
  );
}
