import { useMemo, useState, type FormEvent } from "react";
import { Cpu, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AI_CAPABILITY_IDS,
  AI_CAPABILITY_META,
  AI_STRATEGY_IDS,
  isAiCapabilityId,
  isAiStrategyId,
  type AiCapabilityId,
} from "@/lib/ai/routeCatalog";
import {
  useAdminAiPlanExtractionMetrics,
  useAdminAiResolutionMetrics,
  useAdminAiRouteOverrides,
  useClearAiRouteOverride,
  useSetAiRouteOverride,
} from "@/hooks/admin/useAdminAiRoutes";

function defaultExpiryLocal(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function rate(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${(Number(n) * 100).toFixed(1)}%`;
}

const selectClass =
  "flex h-10 w-full rounded-xl border-0 bg-input shadow-engraved px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

export default function AdminAiRoutes() {
  const overridesQuery = useAdminAiRouteOverrides();
  const planMetrics = useAdminAiPlanExtractionMetrics();
  const resolutionMetrics = useAdminAiResolutionMetrics();
  const setPin = useSetAiRouteOverride();
  const clearPin = useClearAiRouteOverride();

  const [capability, setCapability] = useState<AiCapabilityId>("plan_label_extraction");
  const [strategy, setStrategy] = useState<string>(AI_STRATEGY_IDS[0]);
  const [reason, setReason] = useState("");
  const [expiresLocal, setExpiresLocal] = useState(defaultExpiryLocal);

  const pinByCapability = useMemo(() => {
    const map = new Map<string, NonNullable<typeof overridesQuery.data>[number]>();
    for (const row of overridesQuery.data ?? []) {
      map.set(row.capability, row);
    }
    return map;
  }, [overridesQuery.data]);

  async function onSetPin(event: FormEvent) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("A reason is required so the next person can safely revert the pin.");
      return;
    }
    if (!expiresLocal) {
      toast.error("Pins must expire. Pick a date — default is 7 days.");
      return;
    }
    if (!isAiStrategyId(strategy) || !isAiCapabilityId(capability)) {
      toast.error("Only approved capabilities and strategies can be pinned.");
      return;
    }
    const expiresAt = new Date(expiresLocal);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      toast.error("Expiry must be a future date and time.");
      return;
    }
    try {
      await setPin.mutateAsync({
        capability,
        strategy,
        reason: trimmed,
        expiresAt: expiresAt.toISOString(),
      });
      toast.success(`Pinned ${capability} to ${strategy}`);
      setReason("");
      setExpiresLocal(defaultExpiryLocal());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set pin");
    }
  }

  async function onClear(cap: string) {
    if (!window.confirm(`Clear the pin on ${cap} and return to the compiled default?`)) return;
    try {
      await clearPin.mutateAsync(cap);
      toast.success(`Cleared pin on ${cap}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not clear pin");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Cpu className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">AI routes</h1>
          <p className="text-sm text-muted-foreground">
            Emergency pins only. Code stays authoritative; a pin reorders approved strategies and
            expires. It cannot authorise an unapproved model.
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Compiled defaults vs pins</h2>
        {overridesQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading pins…
          </div>
        ) : overridesQuery.error ? (
          <p className="text-sm text-destructive">
            {(overridesQuery.error as Error).message || "Failed to load pins"}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[10px] bg-card shadow-e1">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 text-muted-foreground font-mono uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-medium">Capability</th>
                  <th className="px-3 py-2 font-medium">Compiled</th>
                  <th className="px-3 py-2 font-medium">Pin</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium">Expires</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {AI_CAPABILITY_IDS.map((id) => {
                  const meta = AI_CAPABILITY_META[id];
                  const pin = pinByCapability.get(id);
                  const expired =
                    pin?.expires_at != null && new Date(pin.expires_at).getTime() <= Date.now();
                  return (
                    <tr key={id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium text-foreground">{meta.label}</p>
                        <p className="font-mono text-muted-foreground">{id}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground">{meta.compiledPrimary}</td>
                      <td className="px-3 py-2">
                        {pin ? (
                          <span className={cn("font-mono", expired && "text-muted-foreground line-through")}>
                            {pin.strategy}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[220px] truncate">
                        {pin?.reason ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {pin?.expires_at
                          ? formatDistanceToNow(new Date(pin.expires_at), { addSuffix: true })
                          : pin
                            ? "never"
                            : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {pin && !expired ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={clearPin.isPending}
                            onClick={() => void onClear(id)}
                          >
                            Clear
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Set a pin</h2>
        <form
          onSubmit={(e) => void onSetPin(e)}
          className="rounded-[10px] bg-card shadow-e1 p-4 grid gap-3 sm:grid-cols-2"
        >
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground font-mono text-xs uppercase tracking-wider">
              Capability
            </span>
            <select
              className={selectClass}
              value={capability}
              onChange={(e) => setCapability(e.target.value as AiCapabilityId)}
            >
              {AI_CAPABILITY_IDS.map((id) => (
                <option key={id} value={id}>
                  {AI_CAPABILITY_META[id].label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground font-mono text-xs uppercase tracking-wider">
              Approved strategy
            </span>
            <select
              className={selectClass}
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              {AI_STRATEGY_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground font-mono text-xs uppercase tracking-wider">
              Reason
            </span>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provider 503s / deprecation window — why this pin exists"
              required
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground font-mono text-xs uppercase tracking-wider">
              Expires
            </span>
            <Input
              type="datetime-local"
              value={expiresLocal}
              onChange={(e) => setExpiresLocal(e.target.value)}
              required
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={setPin.isPending}>
              {setPin.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Pin strategy
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Plan extraction (90 days)</h2>
        <p className="text-xs text-muted-foreground">
          What reviewers corrected or rejected. Representative, not comparable across time.
        </p>
        {planMetrics.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading metrics…
          </div>
        ) : planMetrics.error ? (
          <p className="text-sm text-destructive">
            {(planMetrics.error as Error).message || "Failed to load plan metrics"}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[10px] bg-card shadow-e1">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 text-muted-foreground font-mono uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium">Prompt</th>
                  <th className="px-3 py-2 font-medium">Proposals</th>
                  <th className="px-3 py-2 font-medium">Corrected</th>
                  <th className="px-3 py-2 font-medium">Rejected</th>
                  <th className="px-3 py-2 font-medium">Imported</th>
                </tr>
              </thead>
              <tbody>
                {(planMetrics.data ?? []).map((row) => (
                  <tr
                    key={`${row.model}-${row.prompt_version}-${row.provider}`}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-3 py-2 font-mono text-foreground">
                      {row.model}
                      <span className="block text-muted-foreground">{row.provider}</span>
                    </td>
                    <td className="px-3 py-2 font-mono">{row.prompt_version}</td>
                    <td className="px-3 py-2 tabular-nums">{row.proposals}</td>
                    <td className="px-3 py-2 tabular-nums">{rate(row.correction_rate)}</td>
                    <td className="px-3 py-2 tabular-nums">{rate(row.rejection_rate)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.imported}</td>
                  </tr>
                ))}
                {(planMetrics.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No plan extractions in this window
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Suggestion corrections (90 days)</h2>
        <p className="text-xs text-muted-foreground">
          Not attributable to a model until create-task audits store the originating request id.
        </p>
        {resolutionMetrics.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : resolutionMetrics.error ? (
          <p className="text-sm text-destructive">
            {(resolutionMetrics.error as Error).message || "Failed to load suggestion metrics"}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[10px] bg-card shadow-e1">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 text-muted-foreground font-mono uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-medium">Day</th>
                  <th className="px-3 py-2 font-medium">Suggestions</th>
                  <th className="px-3 py-2 font-medium">Corrections</th>
                  <th className="px-3 py-2 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {(resolutionMetrics.data ?? []).slice(0, 14).map((row) => (
                  <tr key={row.day} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 font-mono">{row.day}</td>
                    <td className="px-3 py-2 tabular-nums">{row.suggestions}</td>
                    <td className="px-3 py-2 tabular-nums">{row.corrections}</td>
                    <td className="px-3 py-2 tabular-nums">{rate(row.correction_rate)}</td>
                  </tr>
                ))}
                {(resolutionMetrics.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      No suggestion audits in this window
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
