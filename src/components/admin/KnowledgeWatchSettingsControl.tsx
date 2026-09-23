/**
 * Compact Watch settings — not a configuration dashboard.
 */
import { useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AdminKnowledgeCataloguePanel } from "@/components/admin/AdminKnowledgeCataloguePanel";
import {
  useKnowledgeWatchRuns,
  useKnowledgeWatchSettings,
  useRunKnowledgeWatch,
  useSetKnowledgeWatchSettings,
} from "@/hooks/admin/useKnowledgeWatch";
import {
  formatAllowanceEstimate,
  formatUsageLine,
  RESEARCH_ALLOWANCE_LIMITS,
  type AutomatedResearchMode,
  type ResearchAllowance,
} from "@/lib/content/knowledgeWatch";
import { cn } from "@/lib/utils";

export function KnowledgeWatchSettingsControl() {
  const settingsQuery = useKnowledgeWatchSettings();
  const runsQuery = useKnowledgeWatchRuns(5);
  const setSettings = useSetKnowledgeWatchSettings();
  const runWatch = useRunKnowledgeWatch();
  const [open, setOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const settings = settingsQuery.data;
  const automated = settings?.automated_research ?? "paused";
  const allowance = settings?.research_allowance ?? "light";
  const usage = settings?.usage;
  const limits = RESEARCH_ALLOWANCE_LIMITS[allowance];
  const atLimit =
    usage &&
    (usage.searches_used >= limits.searches ||
      usage.pages_used >= limits.pages ||
      usage.tokens_used >= limits.tokens ||
      usage.cost_units_used >= limits.cost_units);

  const save = async (patch: {
    automated_research?: AutomatedResearchMode;
    research_allowance?: ResearchAllowance;
  }) => {
    try {
      await setSettings.mutateAsync({
        ...patch,
        reason: "Admin Watch settings change from Knowledge control room",
      });
    } catch {
      // Toast handled in mutation onError
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="border-0 btn-neomorphic text-xs gap-1.5">
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
          Watch settings
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Watch settings</SheetTitle>
          <SheetDescription>
            Approve the official catalogue once, then Watch reports only consequential
            changes. Discovery is not verified Knowledge and not permission to publish.
            Research limits are enforced server-side.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {settingsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : settingsQuery.isError ? (
            <p className="text-sm text-destructive">
              {(settingsQuery.error as Error)?.message ||
                "Couldn't load Watch settings. Confirm you are a platform admin and migrations are applied."}
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="watch-automated">Automated research</Label>
                <Select
                  value={automated}
                  onValueChange={(v) => void save({ automated_research: v as AutomatedResearchMode })}
                  disabled={setSettings.isPending}
                >
                  <SelectTrigger id="watch-automated" className="input-neomorphic">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="on">On</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Default is Paused. Scheduled runs do nothing while paused; Run Watch now still
                  respects the monthly allowance.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="watch-allowance">Research allowance</Label>
                <Select
                  value={allowance}
                  onValueChange={(v) => void save({ research_allowance: v as ResearchAllowance })}
                  disabled={setSettings.isPending}
                >
                  <SelectTrigger id="watch-allowance" className="input-neomorphic">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="thorough">Thorough</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{formatAllowanceEstimate(allowance)}</p>
              </div>

              <div className="rounded-xl bg-muted/30 px-3 py-2.5 space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  This month ({usage?.period_ym ?? "—"})
                </p>
                <p className="text-sm tabular-nums text-foreground">
                  {usage ? formatUsageLine(usage, allowance) : "No usage yet"}
                </p>
                {atLimit ? (
                  <p className="text-xs text-destructive">
                    Allowance reached — research stops cleanly until next period or an authorised
                    settings change.
                  </p>
                ) : null}
              </div>

              <AdminKnowledgeCataloguePanel />

              <Button
                type="button"
                className="w-full shadow-primary-btn border-0"
                disabled={runWatch.isPending || Boolean(atLimit)}
                onClick={() => void runWatch.mutateAsync("manual")}
              >
                {runWatch.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Running…
                  </>
                ) : (
                  "Run Watch now"
                )}
              </Button>

              {settings?.last_run?.summary ? (
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Last run
                  </p>
                  <p className="text-sm text-foreground leading-snug">{settings.last_run.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {settings.last_run.status}
                    {settings.last_run.started_at
                      ? ` · ${new Date(settings.last_run.started_at).toLocaleString()}`
                      : ""}
                  </p>
                </div>
              ) : null}

              <div>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => setAdvancedOpen((v) => !v)}
                >
                  {advancedOpen ? "Hide advanced diagnostics" : "Advanced diagnostics"}
                </button>
                {advancedOpen ? (
                  <ul className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {(runsQuery.data ?? []).map((run) => (
                      <li
                        key={run.id}
                        className={cn(
                          "rounded-lg bg-card/80 shadow-e1 px-2.5 py-2 text-xs text-muted-foreground"
                        )}
                      >
                        <p className="font-medium text-foreground">
                          {run.trigger} · {run.status}
                        </p>
                        <p className="mt-0.5 leading-snug">{run.summary}</p>
                        <p className="mt-1 tabular-nums">
                          {run.searches_used} searches · {run.pages_used} pages ·{" "}
                          {run.tokens_used} tokens
                        </p>
                      </li>
                    ))}
                    {(runsQuery.data ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No runs yet.</p>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
