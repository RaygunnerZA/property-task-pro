/**
 * Knowledge Reporting — outcomes plus recent machinery activity
 * (Watch runs, automation state, overnight / gap research jobs).
 */
import { Loader2 } from "lucide-react";
import {
  isOpenAiBatchJob,
  useAdminAiBatchJobs,
  type AiBatchJobRow,
} from "@/hooks/admin/useAdminAiBatch";
import {
  useKnowledgeWatchRuns,
  useKnowledgeWatchSettings,
  type KnowledgeWatchRunRow,
} from "@/hooks/admin/useKnowledgeWatch";
import {
  formatAllowanceEstimate,
  formatUsageLine,
  RESEARCH_ALLOWANCE_LIMITS,
} from "@/lib/content/knowledgeWatch";
import { cn } from "@/lib/utils";

type OutcomeTotals = {
  created: number;
  verified: number;
  reused: number;
  answered: number;
};

function MetricChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-card/80 shadow-e1 px-3 py-2 min-w-[7rem]">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function relativeWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(iso).toLocaleString();
}

function triggerLabel(trigger: string): string {
  switch (trigger) {
    case "manual":
      return "Manual (Run Watch now)";
    case "scheduled":
      return "Scheduled";
    case "cron":
      return "Cron";
    default:
      return trigger || "Unknown trigger";
  }
}

function runStatusClass(status: string): string {
  if (status === "failed" || status === "cancelled") return "text-destructive";
  if (status === "succeeded" || status === "skipped") return "text-emerald-700 dark:text-emerald-400";
  if (status === "running" || status === "started") return "text-foreground";
  return "text-muted-foreground";
}

function skipReasonsLine(skip: unknown): string | null {
  if (!Array.isArray(skip) || skip.length === 0) return null;
  const parts = skip
    .slice(0, 3)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const reason = typeof row.reason === "string" ? row.reason : null;
      const detail = typeof row.detail === "string" ? row.detail : null;
      if (reason && detail) return `${reason}: ${detail}`;
      return reason || detail;
    })
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function batchJobLabel(job: AiBatchJobRow): string {
  if (job.capability === "knowledge_guidance_draft") {
    return job.mode === "improve" ? "Improve guidance" : "Generate guidance";
  }
  if (job.capability === "knowledge_gap_research") return "Gap research";
  if (job.capability === "content_seo_draft") return "Content SEO";
  if (job.capability === "content_brief_draft") return "Content brief";
  if (job.capability === "content_output_draft") return "Content outputs";
  if (job.capability === "content_visual_brief") return "Content visual";
  return job.capability;
}

function batchStatusLabel(status: string): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "submitted":
      return "Submitted";
    case "running":
      return "Running";
    case "intake_pending":
      return "Fetching sources";
    case "succeeded":
      return "Done";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function WatchRunRow({ run }: { run: KnowledgeWatchRunRow }) {
  const skips = skipReasonsLine(run.skip_reasons);
  return (
    <li className="rounded-lg bg-muted/25 px-3 py-2.5 space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {triggerLabel(run.trigger)}
          <span className={cn("ml-2 text-xs font-normal", runStatusClass(run.status))}>
            {run.status}
          </span>
        </p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {relativeWhen(run.started_at)}
        </p>
      </div>
      <p className="text-xs text-muted-foreground leading-snug">
        {run.summary?.trim() ||
          (run.error_message ? run.error_message : "No summary recorded for this run.")}
      </p>
      <p className="text-[11px] text-muted-foreground/90 tabular-nums">
        +{run.subjects_added} subjects · {run.subjects_updated} updated · {run.searches_used}{" "}
        searches · {run.pages_used} pages
      </p>
      {skips ? (
        <p className="text-[11px] text-amber-800/90 dark:text-amber-200/80 leading-snug">{skips}</p>
      ) : null}
    </li>
  );
}

export function AdminKnowledgeReportingPanel({ totals }: { totals: OutcomeTotals }) {
  const settingsQuery = useKnowledgeWatchSettings();
  const runsQuery = useKnowledgeWatchRuns(15);
  const jobsQuery = useAdminAiBatchJobs();

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

  const runs = runsQuery.data ?? [];
  const jobs = (jobsQuery.data ?? []).slice(0, 12);
  const openJobs = jobs.filter((j) => isOpenAiBatchJob(j));
  const knowledgeJobs = jobs.filter(
    (j) =>
      j.capability === "knowledge_gap_research" ||
      j.capability === "knowledge_guidance_draft" ||
      j.capability.startsWith("knowledge_")
  );

  const loading = settingsQuery.isLoading || runsQuery.isLoading || jobsQuery.isLoading;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Reporting</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Outcomes plus whether Watch, research, or overnight jobs have actually run. Nothing
          here publishes or Accepts Knowledge.
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Outcomes
        </h3>
        <div className="flex flex-wrap gap-2">
          <MetricChip label="Verified of created" value={`${totals.verified} of ${totals.created}`} />
          <MetricChip label="Reused" value={totals.reused} />
          <MetricChip label="Answered" value={totals.answered} />
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
            <h3 className="text-sm font-semibold">Automation</h3>
            {settingsQuery.isError ? (
              <p className="text-sm text-destructive">
                {(settingsQuery.error as Error)?.message ||
                  "Couldn't load Watch settings."}
              </p>
            ) : (
              <>
                <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div>
                    <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Automated research
                    </dt>
                    <dd className="font-medium">
                      {automated === "on" ? "On" : "Paused"}
                      {automated === "paused" ? (
                        <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                          Scheduled / cron triggers will skip until this is On. Manual Run Watch
                          now still works within the monthly allowance.
                        </span>
                      ) : (
                        <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                          Scheduled Watch may run when triggered; still capped by allowance.
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Allowance
                    </dt>
                    <dd className="font-medium capitalize">
                      {allowance}
                      <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                        {formatAllowanceEstimate(allowance)}
                      </span>
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      This month ({usage?.period_ym ?? "—"})
                    </dt>
                    <dd className="text-sm tabular-nums mt-0.5">
                      {usage ? formatUsageLine(usage, allowance) : "No usage recorded yet"}
                    </dd>
                    {atLimit ? (
                      <p className="text-xs text-destructive mt-1">
                        Allowance reached — research stops until next period or a settings change.
                      </p>
                    ) : null}
                  </div>
                </dl>
                {settings?.last_run ? (
                  <div className="rounded-lg bg-muted/30 px-3 py-2 space-y-0.5">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Last Watch run
                    </p>
                    <p className="text-sm leading-snug">
                      {settings.last_run.summary || settings.last_run.status}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {triggerLabel(settings.last_run.trigger)} · {settings.last_run.status} ·{" "}
                      {relativeWhen(settings.last_run.started_at)}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No Watch run recorded yet. Use Watch settings → Run Watch now, or turn
                    Automated research On for scheduled triggers.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Watch activity</h3>
              <p className="text-[11px] text-muted-foreground">
                {runs.length} recent run{runs.length === 1 ? "" : "s"}
              </p>
            </div>
            {runsQuery.isError ? (
              <p className="text-sm text-destructive">
                {(runsQuery.error as Error)?.message || "Couldn't load Watch runs."}
              </p>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing has run. That usually means Automated research is Paused and nobody has
                clicked Run Watch now — or migrations for watch runs are not applied.
              </p>
            ) : (
              <ul className="space-y-2 max-h-[28rem] overflow-y-auto">
                {runs.map((run) => (
                  <WatchRunRow key={run.id} run={run} />
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Overnight &amp; gap research jobs</h3>
              <p className="text-[11px] text-muted-foreground">
                {openJobs.length > 0
                  ? `${openJobs.length} open`
                  : knowledgeJobs.length > 0
                    ? "None open"
                    : "None yet"}
              </p>
            </div>
            {jobsQuery.isError ? (
              <p className="text-sm text-destructive">
                {(jobsQuery.error as Error)?.message || "Couldn't load batch jobs."}
              </p>
            ) : knowledgeJobs.length === 0 && jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No overnight or gap-research jobs yet. Resolve gap / bulk research and guidance
                batches appear here when enqueued.
              </p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {(knowledgeJobs.length > 0 ? knowledgeJobs : jobs).map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-wrap items-start justify-between gap-2 text-sm rounded-lg bg-muted/25 px-3 py-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium">{batchJobLabel(job)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {job.item_count} item{job.item_count === 1 ? "" : "s"}
                        {job.mode ? ` · ${job.mode}` : ""} · {relativeWhen(job.created_at)}
                      </p>
                      {job.error_message ? (
                        <p className="text-[11px] text-destructive leading-snug">
                          {job.error_message}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        "text-xs tabular-nums shrink-0",
                        job.status === "failed" || job.status === "cancelled"
                          ? "text-destructive"
                          : job.status === "succeeded"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground"
                      )}
                    >
                      {batchStatusLabel(job.status)}
                      {job.status === "succeeded" && job.succeeded_count > 0
                        ? ` · ${job.succeeded_count}`
                        : ""}
                      {job.failed_count > 0 ? ` · ${job.failed_count} failed` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
