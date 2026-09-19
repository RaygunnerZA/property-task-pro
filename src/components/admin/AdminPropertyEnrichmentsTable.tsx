import { useNavigate } from "react-router-dom";
import { Leaf } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  useAdminPropertyEnrichments,
  type AdminPropertyEnrichment,
} from "@/hooks/admin/useAdminPropertyEnrichments";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    found: "bg-primary/15 text-primary",
    not_found: "bg-muted text-muted-foreground",
    error: "bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-[6px] text-caption font-mono uppercase tracking-wider",
        styles[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function RatingCell({ row }: { row: AdminPropertyEnrichment }) {
  if (row.status !== "found") {
    return <span className="text-muted-foreground/50">—</span>;
  }
  const current = row.current_rating ?? "—";
  const potential = row.potential_rating;
  return (
    <span className="font-medium">
      {current}
      {potential ? (
        <span className="text-muted-foreground font-normal"> → {potential}</span>
      ) : null}
    </span>
  );
}

export function AdminPropertyEnrichmentsTable({ orgId }: { orgId?: string }) {
  const navigate = useNavigate();
  const { data: rows = [], isLoading, error } = useAdminPropertyEnrichments(orgId);
  const showOrg = !orgId;
  const colCount = showOrg ? 7 : 6;

  const thClass =
    "px-4 py-3 text-left text-xs font-mono text-muted-foreground uppercase tracking-wider";
  const tdClass = "px-4 py-3 text-sm";

  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-medium mb-3">
        <Leaf className="w-4 h-4 text-muted-foreground" />
        Register enrichments
      </h2>
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-card px-4 py-3 mb-3">
          Failed to load enrichments.
        </div>
      )}
      <div className="rounded-xl border border-border overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-muted/40">
            <tr>
              {showOrg ? <th className={thClass}>Organisation</th> : null}
              <th className={thClass}>Property</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>EPC</th>
              <th className={thClass}>Certificate</th>
              <th className={thClass}>Postcode</th>
              <th className={thClass}>Retrieved</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No register enrichments yet. Saving an England or Wales property runs EPC lookup.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={`${row.property_id}-${row.provider}`}
                  className={cn(
                    "hover:bg-muted/30 transition-colors",
                    showOrg && "cursor-pointer"
                  )}
                  onClick={
                    showOrg ? () => navigate(`/admin/orgs/${row.org_id}`) : undefined
                  }
                >
                  {showOrg ? (
                    <td className={cn(tdClass, "font-medium")}>{row.org_name}</td>
                  ) : null}
                  <td className={cn(tdClass, "font-medium")}>{row.property_label}</td>
                  <td className={tdClass}>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className={tdClass}>
                    <RatingCell row={row} />
                  </td>
                  <td className={cn(tdClass, "font-mono text-xs text-muted-foreground")}>
                    {row.source_id ?? "—"}
                  </td>
                  <td className={cn(tdClass, "font-mono text-xs")}>
                    {row.postal_code ?? "—"}
                    {row.country_code ? (
                      <span className="text-muted-foreground"> · {row.country_code}</span>
                    ) : null}
                  </td>
                  <td className={cn(tdClass, "text-muted-foreground")}>
                    {row.retrieved_at
                      ? formatDistanceToNow(new Date(row.retrieved_at), { addSuffix: true })
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
