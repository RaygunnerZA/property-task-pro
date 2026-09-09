import { Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isOpenAiBatchJob,
  useAdminAiBatchJobs,
  useAdminPollAiBatch,
  useFinishPendingResearchJobs,
  usePollOpenAiBatchJobs,
  type AiBatchJobRow,
} from "@/hooks/admin/useAdminAiBatch";
import { cn } from "@/lib/utils";

function jobLabel(job: AiBatchJobRow): string {
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

function statusLabel(status: string): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "submitted":
      return "Submitted to Gemini";
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

export function AdminAiBatchJobsBanner() {
  const jobsQuery = useAdminAiBatchJobs();
  const poll = useAdminPollAiBatch();
  const jobs = jobsQuery.data ?? [];
  usePollOpenAiBatchJobs(jobs);
  useFinishPendingResearchJobs(jobs);

  const visible = jobs.filter((job) => {
    if (isOpenAiBatchJob(job)) return true;
    if (!job.completed_at) return false;
    return Date.now() - new Date(job.completed_at).getTime() < 6 * 60 * 60 * 1000;
  });
  if (visible.length === 0) return null;

  return (
    <div className="rounded-xl bg-card/80 shadow-e1 px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Overnight jobs
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          disabled={poll.isPending}
          onClick={() => poll.mutate({})}
        >
          {poll.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Check now
        </Button>
      </div>
      <ul className="space-y-1.5">
        {visible.slice(0, 6).map((job) => (
          <li key={job.id} className="flex items-start justify-between gap-3 text-xs">
            <span>
              {jobLabel(job)}
              <span className="text-muted-foreground"> · {job.item_count} item{job.item_count === 1 ? "" : "s"}</span>
            </span>
            <span
              className={cn(
                "tabular-nums shrink-0",
                job.status === "failed" || job.status === "cancelled"
                  ? "text-destructive"
                  : job.status === "succeeded"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground"
              )}
            >
              {statusLabel(job.status)}
              {job.status === "succeeded" && job.succeeded_count > 0
                ? ` · ${job.succeeded_count}`
                : ""}
              {job.failed_count > 0 ? ` · ${job.failed_count} failed` : ""}
            </span>
          </li>
        ))}
      </ul>
      {visible.some((j) => j.error_message) ? (
        <p className="text-[11px] text-destructive/90">
          {visible.find((j) => j.error_message)?.error_message}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Half-price Gemini Batch. Typical wait 1–4 hours (up to 24h). Drafts stay unverified.
        </p>
      )}
    </div>
  );
}
