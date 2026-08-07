import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type UtilizationRow = {
  org_id: string;
  org_name: string;
  plan_id: string | null;
  plan_name: string;
  billing_state: string;
  property_count: number;
  active_properties_limit: number;
  property_utilization: number | null;
  coordinating_count: number;
  coordinating_seats_limit: number;
  seat_utilization: number | null;
  staff_headcount: number;
  storage_used_bytes: number;
  evidence_bytes_allowance: number;
  evidence_utilization: number | null;
  ai_ops_used: number;
  ai_ops_allowance: number;
  ai_utilization: number | null;
  ai_cost_usd_period: number;
  seat_addon: number;
  storage_addon_bytes: number;
  ai_addon_ops: number;
};

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

export default function AdminBillingUtilization() {
  const { data = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-billing-utilization"],
    queryFn: async () => {
      const { data: rows, error: qError } = await supabase.rpc(
        "admin_billing_utilization_snapshot" as never
      );
      if (qError) throw qError;
      return (rows ?? []) as UtilizationRow[];
    },
    staleTime: 60_000,
  });

  function downloadCsv() {
    const headers = [
      "org_id",
      "org_name",
      "plan_id",
      "plan_name",
      "billing_state",
      "property_count",
      "active_properties_limit",
      "property_utilization",
      "coordinating_count",
      "coordinating_seats_limit",
      "seat_utilization",
      "staff_headcount",
      "storage_used_bytes",
      "evidence_bytes_allowance",
      "evidence_utilization",
      "ai_ops_used",
      "ai_ops_allowance",
      "ai_utilization",
      "ai_cost_usd_period",
      "seat_addon",
      "storage_addon_bytes",
      "ai_addon_ops",
    ];
    const lines = [
      headers.join(","),
      ...data.map((r) =>
        [
          r.org_id,
          JSON.stringify(r.org_name ?? ""),
          r.plan_id ?? "home",
          JSON.stringify(r.plan_name ?? ""),
          r.billing_state,
          r.property_count,
          r.active_properties_limit,
          r.property_utilization ?? "",
          r.coordinating_count,
          r.coordinating_seats_limit,
          r.seat_utilization ?? "",
          r.staff_headcount,
          r.storage_used_bytes,
          r.evidence_bytes_allowance,
          r.evidence_utilization ?? "",
          r.ai_ops_used,
          r.ai_ops_allowance,
          r.ai_utilization ?? "",
          r.ai_cost_usd_period,
          r.seat_addon,
          r.storage_addon_bytes,
          r.ai_addon_ops,
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-utilization-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Billing utilization</h1>
            <p className="text-sm text-muted-foreground">
              Phase 7 packaging snapshot — plan × meter utilization for finance review.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={data.length === 0}
            onClick={downloadCsv}
          >
            <Download className="h-4 w-4 mr-1.5" />
            CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">
          {(error as Error).message || "Failed to load utilization"}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[10px] bg-card shadow-e1">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/60 text-muted-foreground font-mono uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 font-medium">Org</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Props</th>
                <th className="px-3 py-2 font-medium">Seats</th>
                <th className="px-3 py-2 font-medium">Evidence</th>
                <th className="px-3 py-2 font-medium">AI</th>
                <th className="px-3 py-2 font-medium">AI $</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr
                  key={row.org_id}
                  className="border-b border-border/40 last:border-0"
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground truncate max-w-[180px]">
                      {row.org_name}
                    </p>
                    <p className="text-muted-foreground font-mono">{row.billing_state}</p>
                  </td>
                  <td className="px-3 py-2 text-foreground">{row.plan_name}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.property_count}/{row.active_properties_limit}{" "}
                    <span
                      className={cn(
                        (row.property_utilization ?? 0) >= 0.85 && "text-warning-foreground",
                        (row.property_utilization ?? 0) >= 1 && "text-destructive"
                      )}
                    >
                      ({pct(row.property_utilization)})
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.coordinating_count}/{row.coordinating_seats_limit} (
                    {pct(row.seat_utilization)})
                  </td>
                  <td className="px-3 py-2 tabular-nums">{pct(row.evidence_utilization)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.ai_ops_used}/{row.ai_ops_allowance} ({pct(row.ai_utilization)})
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    ${Number(row.ai_cost_usd_period || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No organisations
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
