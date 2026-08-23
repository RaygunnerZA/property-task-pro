import { useMemo, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import {
  useAdminKnowledgeMetrics,
  useAdminKnowledgeQueue,
  useAdminSetKnowledgeStatus,
} from "@/hooks/admin/useAdminKnowledge";
import { AdminKnowledgeIntakePanel } from "@/components/admin/AdminKnowledgeIntakePanel";
import { AdminContentTreePanel } from "@/components/admin/AdminContentTreePanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KnowledgeRow, KnowledgeStatus } from "@/types/knowledge";
import { toast } from "sonner";

type AdminKnowledgeTab = "review" | "publishing" | "intake" | "content" | "metrics";

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
  const [tab, setTab] = useState<AdminKnowledgeTab>("review");
  const statuses = useMemo<KnowledgeStatus[]>(
    () => (tab === "publishing" ? ["verified"] : ["candidate", "verified", "stale"]),
    [tab]
  );
  const { data, isLoading, error } = useAdminKnowledgeQueue(statuses);
  const metricsQuery = useAdminKnowledgeMetrics();
  const setStatus = useAdminSetKnowledgeStatus();

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

  const handleStatus = (id: string, status: KnowledgeStatus) => {
    setStatus.mutate(
      { knowledgeId: id, status },
      {
        onSuccess: () => toast.success(`Status → ${status}`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
      }
    );
  };

  const tabs: { id: AdminKnowledgeTab; label: string }[] = [
    { id: "review", label: "Review queue" },
    { id: "publishing", label: "Publishing" },
    { id: "intake", label: "Intake" },
    { id: "content", label: "Content tree" },
    { id: "metrics", label: "Metrics" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Knowledge
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Intake → review → content tree. Critic is mandatory; nothing auto-publishes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={tab === t.id ? "default" : "outline"}
              className={cn("border-0", tab === t.id ? "shadow-primary-btn" : "btn-neomorphic")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {tab === "intake" && <AdminKnowledgeIntakePanel />}
      {tab === "content" && <AdminContentTreePanel />}

      {tab === "metrics" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <MetricChip label="Created" value={totals.created} />
            <MetricChip label="Verified" value={totals.verified} />
            <MetricChip label="Reused" value={totals.reused} />
            <MetricChip label="Answered" value={totals.answered} />
            <MetricChip label="Automation" value={totals.automation} />
            <MetricChip label="Minutes saved" value={Math.round(totals.minutes)} />
          </div>
          {metricsQuery.isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          <div className="overflow-x-auto rounded-xl bg-card/80 shadow-e1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/40">
                  <th className="p-3 font-medium">Organisation</th>
                  <th className="p-3 font-medium">Created</th>
                  <th className="p-3 font-medium">Verified</th>
                  <th className="p-3 font-medium">Published</th>
                  <th className="p-3 font-medium">Reused</th>
                  <th className="p-3 font-medium">Answered</th>
                </tr>
              </thead>
              <tbody>
                {orgMetrics.map((r) => (
                  <tr key={r.org_id} className="border-b border-border/20">
                    <td className="p-3">{r.org_name}</td>
                    <td className="p-3 tabular-nums">{r.knowledge_created}</td>
                    <td className="p-3 tabular-nums">{r.knowledge_verified}</td>
                    <td className="p-3 tabular-nums">{r.knowledge_published}</td>
                    <td className="p-3 tabular-nums">{r.knowledge_reused}</td>
                    <td className="p-3 tabular-nums">{r.questions_answered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(tab === "review" || tab === "publishing") && (
        <div className="space-y-3">
          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load queue"}
            </p>
          )}
          {!isLoading && (data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No items in this queue.</p>
          )}
          {(data ?? []).map((row) => (
            <QueueRow
              key={row.id}
              row={row}
              busy={setStatus.isPending}
              onStatus={handleStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
