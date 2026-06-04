/**
 * Signal Diagnostics Panel — dev/admin only, read-only.
 * Shows recent signal_source_runs so you can verify the scanner
 * is running, throttling correctly, and not over-emitting.
 *
 * Rendered inside DevToolsDropdown; gated by isDevBuild.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { cn } from "@/lib/utils";
import { Activity, RefreshCw, CheckCircle, AlertTriangle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { runEnvironmentalScanner } from "@/services/signals/signalEngineClient";

interface RunRow {
  id: string;
  source_key: string;
  org_id: string | null;
  run_type: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  orgs_scanned: number;
  properties_scanned: number;
  skipped: number;
  api_calls: number;
  signals_created: number;
  duplicates_ignored: number;
  expired_cleared: number;
  errors: Array<{ property_id?: string; message: string }>;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle className="h-3.5 w-3.5 text-teal-500" />,
  partial: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
  failed:  <XCircle className="h-3.5 w-3.5 text-red-500" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-500" />,
  skipped: <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />,
};

function fmt(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function elapsed(start: string, end: string | null): string {
  if (!end) return "…";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function SignalDiagnosticsPanel() {
  const { orgId } = useActiveOrg();
  const [runs, setRuns]       = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("signal_source_runs")
      .select("*")
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .order("started_at", { ascending: false })
      .limit(20);
    setRuns((data ?? []) as RunRow[]);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { void fetchRuns(); }, [fetchRuns]);

  const handleManualScan = async () => {
    if (!orgId) return;
    setScanning(true);
    await runEnvironmentalScanner(orgId, { force: true });
    // brief pause then re-fetch so the new run row appears
    await new Promise((r) => setTimeout(r, 1500));
    await fetchRuns();
    setScanning(false);
  };

  return (
    <div className="flex flex-col gap-3 p-3 min-w-[360px] max-h-[520px] overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-ink">Signal Diagnostics</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={handleManualScan}
            disabled={scanning}
          >
            {scanning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Run scanner (force)
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={fetchRuns}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {runs.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No scanner runs recorded yet. Run the scanner above.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {runs.map((run) => (
          <div
            key={run.id}
            className="rounded-lg border border-border/50 bg-surface shadow-sm"
          >
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/30 rounded-lg transition-colors"
              onClick={() => setExpanded(expanded === run.id ? null : run.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {STATUS_ICON[run.status] ?? STATUS_ICON.running}
                <span className="text-xs font-mono font-medium text-ink truncate">
                  {run.source_key}
                </span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                  run.run_type === "manual" ? "bg-sky-100 text-sky-700" : "bg-muted text-muted-foreground"
                )}>
                  {run.run_type}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {fmt(run.started_at)}
              </span>
            </button>

            {expanded === run.id && (
              <div className="border-t border-border/40 px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <Stat label="Duration"          value={elapsed(run.started_at, run.finished_at)} />
                <Stat label="Status"            value={run.status} />
                <Stat label="Orgs"              value={run.orgs_scanned} />
                <Stat label="Properties scanned" value={run.properties_scanned} />
                <Stat label="Skipped (cooldown)" value={run.skipped} />
                <Stat label="API calls"          value={run.api_calls} />
                <Stat label="Signals created"    value={run.signals_created} />
                <Stat label="Duplicates ignored" value={run.duplicates_ignored} />
                <Stat label="Expired cleared"    value={run.expired_cleared} />
                {run.errors.length > 0 && (
                  <div className="col-span-2 mt-1 rounded bg-red-50 px-2 py-1.5">
                    <p className="font-semibold text-red-600 mb-0.5">Errors ({run.errors.length})</p>
                    {run.errors.map((e, i) => (
                      <p key={i} className="text-red-500 truncate">
                        {e.property_id ? `${e.property_id.slice(0, 8)}… ` : ""}{e.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Showing last 20 runs · Cron: every 6h · Per-property throttle: 12h
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-ink">{value}</span>
    </div>
  );
}
