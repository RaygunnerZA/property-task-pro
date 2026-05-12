import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUpDown, Loader2 } from "lucide-react";
import { useAdminOrgList, AdminOrg } from "@/hooks/admin/useAdminOrgList";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SortKey = keyof AdminOrg;
type SortDir = "asc" | "desc";

function OrgTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    personal: "bg-muted text-muted-foreground",
    business: "bg-primary/15 text-primary",
    contractor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-mono uppercase tracking-wide",
        styles[type] ?? "bg-muted text-muted-foreground"
      )}
    >
      {type}
    </span>
  );
}

function RelativeTime({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span className="text-muted-foreground text-sm">
      {formatDistanceToNow(new Date(value), { addSuffix: true })}
    </span>
  );
}

export default function AdminOrgList() {
  const navigate = useNavigate();
  const { orgs, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } = useAdminOrgList();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Client-side search + sort over all fetched pages
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = q ? orgs.filter((o) => o.org_name.toLowerCase().includes(q)) : orgs;
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [orgs, search, sortKey, sortDir]);

  // Reset sort when search changes
  useEffect(() => {
    setSortDir("desc");
  }, [search]);

  const thClass =
    "px-4 py-3 text-left text-xs font-mono text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors";
  const tdClass = "px-4 py-3 text-sm";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Organisations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading
              ? "Loading…"
              : `${orgs.length} organisation${orgs.length !== 1 ? "s" : ""}${hasNextPage ? "+" : ""}`}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 h-9 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-56"
          />
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-[8px] px-4 py-3">
          Failed to load organisations.
        </div>
      )}

      <div className="rounded-[12px] border border-border overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-muted/40">
            <tr>
              {(
                [
                  { key: "org_name", label: "Organisation" },
                  { key: "org_type", label: "Type" },
                  { key: "member_count", label: "Members" },
                  { key: "property_count", label: "Properties" },
                  { key: "task_count", label: "Tasks" },
                  { key: "last_activity", label: "Last activity" },
                  { key: "created_at", label: "Created" },
                ] as { key: SortKey; label: string }[]
              ).map(({ key, label }) => (
                <th key={key} className={thClass} onClick={() => toggleSort(key)}>
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {sortKey === key && (
                      <ArrowUpDown className="w-3 h-3 opacity-60" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {search ? "No orgs match that search." : "No organisations found."}
                </td>
              </tr>
            ) : (
              filtered.map((org) => (
                <tr
                  key={org.org_id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/orgs/${org.org_id}`)}
                >
                  <td className={cn(tdClass, "font-medium text-foreground")}>{org.org_name}</td>
                  <td className={tdClass}>
                    <OrgTypeBadge type={org.org_type} />
                  </td>
                  <td className={tdClass}>{org.member_count}</td>
                  <td className={tdClass}>{org.property_count}</td>
                  <td className={tdClass}>{org.task_count}</td>
                  <td className={tdClass}>
                    <RelativeTime value={org.last_activity} />
                  </td>
                  <td className={tdClass}>
                    <span className="text-muted-foreground text-sm">
                      {new Date(org.created_at).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load more — only shown when the server reports there are more pages */}
      {hasNextPage && !search && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shadow-sm"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
