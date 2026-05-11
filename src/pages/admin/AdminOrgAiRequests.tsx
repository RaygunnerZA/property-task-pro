import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { useAdminOrgAiRequests, AdminAiRequest } from "@/hooks/admin/useAdminOrgAiRequests";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  success: "bg-primary/15 text-primary",
  error: "bg-destructive/15 text-destructive",
  timeout: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  fallback: "bg-muted text-muted-foreground",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-mono uppercase tracking-wide",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </span>
  );
}

function ExpandedRow({ req }: { req: AdminAiRequest }) {
  return (
    <tr className="bg-muted/30">
      <td colSpan={9} className="px-6 py-3 text-xs font-mono text-muted-foreground">
        {req.error_message && (
          <div className="mb-2">
            <span className="text-destructive font-medium">Error: </span>
            {req.error_message}
          </div>
        )}
        {req.entity_type && req.entity_id && (
          <div>
            <span className="text-muted-foreground">Entity: </span>
            {req.entity_type} · {req.entity_id}
          </div>
        )}
      </td>
    </tr>
  );
}

export default function AdminOrgAiRequests() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { data: requests = [], isLoading, error } = useAdminOrgAiRequests(orgId ?? "");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [functionFilter, setFunctionFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const uniqueFunctions = useMemo(
    () => Array.from(new Set(requests.map((r) => r.function_name))).sort(),
    [requests]
  );

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (functionFilter !== "all" && r.function_name !== functionFilter) return false;
      return true;
    });
  }, [requests, statusFilter, functionFilter]);

  const thClass = "px-3 py-2.5 text-left text-xs font-mono text-muted-foreground uppercase tracking-wide";
  const tdClass = "px-3 py-2.5 text-sm";

  const selectClass =
    "h-8 px-2.5 rounded-[8px] border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <button
        onClick={() => navigate(`/admin/orgs/${orgId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Org Detail
      </button>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">AI Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? "Loading…" : `${filtered.length} of ${requests.length} requests`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">All statuses</option>
            {["success", "error", "timeout", "fallback"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={functionFilter}
            onChange={(e) => setFunctionFilter(e.target.value)}
            className={selectClass}
          >
            <option value="all">All functions</option>
            {uniqueFunctions.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-[8px] px-4 py-3">
          Failed to load AI requests.
        </div>
      )}

      <div className="rounded-[12px] border border-border overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className={thClass} />
              {["Function", "Model", "Status", "Latency", "Cost", "Tokens", "Time"].map((h) => (
                <th key={h} className={thClass}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No requests match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((req) => {
                const isExpanded = expandedId === req.id;
                const hasDetail = !!req.error_message || !!(req.entity_type && req.entity_id);
                return (
                  <>
                    <tr
                      key={req.id}
                      className={cn(
                        "transition-colors",
                        hasDetail ? "cursor-pointer hover:bg-muted/20" : ""
                      )}
                      onClick={() => hasDetail && setExpandedId(isExpanded ? null : req.id)}
                    >
                      <td className="pl-3 pr-1 py-2.5 w-6">
                        {hasDetail ? (
                          isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          )
                        ) : null}
                      </td>
                      <td className={cn(tdClass, "font-mono text-xs")}>{req.function_name}</td>
                      <td className={cn(tdClass, "font-mono text-xs")}>{req.model_used}</td>
                      <td className={tdClass}>
                        <StatusChip status={req.status} />
                      </td>
                      <td className={tdClass}>
                        {req.latency_ms != null ? `${req.latency_ms}ms` : "—"}
                      </td>
                      <td className={tdClass}>
                        {req.cost_usd != null
                          ? `$${req.cost_usd.toFixed(6)}`
                          : "—"}
                      </td>
                      <td className={tdClass}>
                        {req.input_tokens != null && req.output_tokens != null
                          ? `${req.input_tokens.toLocaleString()} / ${req.output_tokens.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className={cn(tdClass, "text-muted-foreground")}>
                        {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                    {isExpanded && hasDetail && <ExpandedRow key={`${req.id}-expanded`} req={req} />}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
