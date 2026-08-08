import { useMemo, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import {
  useAdminKnowledgeMetrics,
  useAdminKnowledgeQueue,
  useAdminSetKnowledgeStatus,
  useAdminUpsertPlatformKnowledge,
} from "@/hooks/admin/useAdminKnowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { KnowledgeRow, KnowledgeStatus } from "@/types/knowledge";
import { toast } from "sonner";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-caption font-mono uppercase tracking-wider bg-muted text-muted-foreground">
      {status}
    </span>
  );
}

function QueueRow({
  row,
  onStatus,
  busy,
}: {
  row: KnowledgeRow;
  onStatus: (id: string, status: KnowledgeStatus) => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-sm truncate">{row.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {row.summary || row.body || "No summary"}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <StatusBadge status={row.status} />
            <StatusBadge status={row.scope} />
            <StatusBadge status={row.source_kind} />
            {row.trust_score != null && (
              <span className="text-xs text-muted-foreground font-mono">
                trust {Number(row.trust_score).toFixed(2)}
              </span>
            )}
            {row.cohort_size != null && (
              <span className="text-xs text-muted-foreground font-mono">
                cohort {row.cohort_size}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {row.status === "candidate" && (
          <Button
            size="sm"
            className="shadow-primary-btn border-0"
            disabled={busy}
            onClick={() => onStatus(row.id, "verified")}
          >
            Verify
          </Button>
        )}
        {(row.status === "candidate" || row.status === "verified") && (
          <Button
            size="sm"
            className="shadow-primary-btn border-0"
            disabled={busy}
            onClick={() => onStatus(row.id, "published")}
          >
            Publish
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          disabled={busy}
          onClick={() => onStatus(row.id, "archived")}
        >
          Reject
        </Button>
        {row.status === "published" && (
          <Button
            size="sm"
            variant="outline"
            className="border-0 btn-neomorphic"
            disabled={busy}
            onClick={() => onStatus(row.id, "stale")}
          >
            Mark stale
          </Button>
        )}
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-card/80 shadow-e1 px-3 py-2 min-w-[7rem]">
      <p className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums text-foreground mt-0.5">{value}</p>
    </div>
  );
}

export default function AdminKnowledgeQueue() {
  const [tab, setTab] = useState<"review" | "publishing" | "metrics">("review");
  const statuses = useMemo<KnowledgeStatus[]>(
    () => (tab === "publishing" ? ["verified"] : ["candidate", "verified", "stale"]),
    [tab]
  );
  const { data, isLoading, error } = useAdminKnowledgeQueue(statuses);
  const metricsQuery = useAdminKnowledgeMetrics();
  const setStatus = useAdminSetKnowledgeStatus();
  const upsert = useAdminUpsertPlatformKnowledge();

  const platformMetrics = useMemo(
    () => metricsQuery.data?.find((r) => r.org_name === "_platform"),
    [metricsQuery.data]
  );
  const orgMetrics = useMemo(
    () => (metricsQuery.data ?? []).filter((r) => r.org_name !== "_platform"),
    [metricsQuery.data]
  );
  const totals = useMemo(() => {
    const rows = metricsQuery.data ?? [];
    return {
      created: rows.reduce((s, r) => s + Number(r.knowledge_created || 0), 0),
      verified: rows.reduce((s, r) => s + Number(r.knowledge_verified || 0), 0),
      reused: rows.reduce((s, r) => s + Number(r.knowledge_reused || 0), 0),
      answered: rows.reduce((s, r) => s + Number(r.questions_answered || 0), 0),
      automation: rows.reduce((s, r) => s + Number(r.automation_created || 0), 0),
      minutes: rows.reduce((s, r) => s + Number(r.time_saved_minutes || 0), 0),
    };
  }, [metricsQuery.data]);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");

  const handleStatus = (id: string, status: KnowledgeStatus) => {
    setStatus.mutate(
      { knowledgeId: id, status },
      {
        onSuccess: () => toast.success(`Status → ${status}`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
      }
    );
  };

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    upsert.mutate(
      { title: title.trim(), summary: summary.trim() || undefined, body: body.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Platform knowledge candidate created");
          setTitle("");
          setSummary("");
          setBody("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Knowledge review
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Platform and community candidates. Org rows appear for support override.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={tab === "review" ? "default" : "outline"}
            className={cn("border-0", tab === "review" ? "shadow-primary-btn" : "btn-neomorphic")}
            onClick={() => setTab("review")}
          >
            Review queue
          </Button>
          <Button
            size="sm"
            variant={tab === "publishing" ? "default" : "outline"}
            className={cn(
              "border-0",
              tab === "publishing" ? "shadow-primary-btn" : "btn-neomorphic"
            )}
            onClick={() => setTab("publishing")}
          >
            Publishing
          </Button>
          <Button
            size="sm"
            variant={tab === "metrics" ? "default" : "outline"}
            className={cn(
              "border-0",
              tab === "metrics" ? "shadow-primary-btn" : "btn-neomorphic"
            )}
            onClick={() => setTab("metrics")}
          >
            Metrics
          </Button>
        </div>
      </div>

      {tab === "metrics" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <MetricChip label="Created" value={totals.created} />
            <MetricChip label="Verified" value={totals.verified} />
            <MetricChip label="Reused" value={totals.reused} />
            <MetricChip label="Questions answered" value={totals.answered} />
            <MetricChip label="Automation created" value={totals.automation} />
            <MetricChip
              label="Time saved"
              value={`${Math.round(totals.minutes)}m`}
            />
          </div>
          {platformMetrics && (
            <p className="text-xs text-muted-foreground">
              Platform knowledge: {platformMetrics.knowledge_created} created ·{" "}
              {platformMetrics.knowledge_verified} verified ·{" "}
              {platformMetrics.knowledge_published} published
            </p>
          )}
          {metricsQuery.isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
          <div className="overflow-x-auto rounded-xl bg-card/80 shadow-e1">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground font-mono uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2">Org</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Verified</th>
                  <th className="px-3 py-2">Reused</th>
                  <th className="px-3 py-2">Answered</th>
                  <th className="px-3 py-2">Automation</th>
                  <th className="px-3 py-2">Time saved</th>
                </tr>
              </thead>
              <tbody>
                {orgMetrics.map((row) => (
                  <tr key={row.org_id} className="border-t border-border/40">
                    <td className="px-3 py-2 font-medium">{row.org_name}</td>
                    <td className="px-3 py-2 tabular-nums">{row.knowledge_created}</td>
                    <td className="px-3 py-2 tabular-nums">{row.knowledge_verified}</td>
                    <td className="px-3 py-2 tabular-nums">{row.knowledge_reused}</td>
                    <td className="px-3 py-2 tabular-nums">{row.questions_answered}</td>
                    <td className="px-3 py-2 tabular-nums">{row.automation_created}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {Math.round(Number(row.time_saved_minutes || 0))}m
                    </td>
                  </tr>
                ))}
                {orgMetrics.length === 0 && !metricsQuery.isLoading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-muted-foreground text-center">
                      No organisation Knowledge activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab !== "metrics" && (
        <>
          <div className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Create platform knowledge
            </p>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="border-0 shadow-engraved bg-input"
            />
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Summary"
              className="border-0 shadow-engraved bg-input"
            />
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Body"
              className="border-0 shadow-engraved bg-input min-h-[80px]"
            />
            <Button
              className="shadow-primary-btn border-0"
              disabled={upsert.isPending}
              onClick={handleCreate}
            >
              {upsert.isPending ? "Saving…" : "Add candidate"}
            </Button>
          </div>

          {isLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load queue"}
            </p>
          )}
          {!isLoading && !error && (data?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">Queue is empty.</p>
          )}
          <div className="space-y-3">
            {(data ?? []).map((row) => (
              <QueueRow
                key={row.id}
                row={row}
                busy={setStatus.isPending}
                onStatus={handleStatus}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
