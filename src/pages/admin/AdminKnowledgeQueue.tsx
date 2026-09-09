import { useMemo, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import {
  useAdminKnowledgeMetrics,
  useAdminKnowledgeQueue,
  useAdminKnowledgeSources,
  useAdminSetKnowledgeStatus,
  type KnowledgeSourceRow,
} from "@/hooks/admin/useAdminKnowledge";
import { AdminKnowledgeIntakePanel } from "@/components/admin/AdminKnowledgeIntakePanel";
import { AdminContentTreePanel } from "@/components/admin/AdminContentTreePanel";
import { AdminKnowledgeDetailSheet } from "@/components/admin/AdminKnowledgeDetailSheet";
import { AdminKnowledgeGapsPanel } from "@/components/admin/AdminKnowledgeGapsPanel";
import { AdminKnowledgeReviewWorkbench } from "@/components/admin/AdminKnowledgeReviewWorkbench";
import { AdminAiBatchJobsBanner } from "@/components/admin/AdminAiBatchJobsBanner";
import { AdminKnowledgeUpdatesPanel } from "@/components/admin/AdminKnowledgeUpdatesPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KnowledgeRow, KnowledgeStatus } from "@/types/knowledge";
import {
  isPublicationReady,
  queueCardPreview,
  statusLabel,
  type TrustCheckStatus,
} from "@/lib/knowledge/knowledgePresentation";
import { toast } from "sonner";

type AdminKnowledgeTab = "add" | "review" | "publishing" | "content" | "metrics";
type AddSubTab = "add" | "gaps" | "update";

function checkTone(status: TrustCheckStatus): string {
  switch (status) {
    case "passed":
      return "text-emerald-700 dark:text-emerald-400";
    case "failed":
      return "text-destructive";
    case "required":
    case "not_run":
      return "text-amber-700 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

function gateErrorMessage(msg: string): string {
  if (msg.includes("guidance_required")) return "Guidance is missing or invalid";
  if (msg.includes("authoritative_source_required")) {
    return "An authoritative source URL is required";
  }
  if (msg.includes("critic_required")) return "Critic must pass before this action";
  if (msg.includes("applicability_uk_nation_required")) {
    return "UK nation required";
  }
  if (msg.includes("verify_before_publish")) return "Verify this item before publishing";
  return msg;
}

function QueueCard({
  row,
  sources,
  busy,
  onOpen,
  onReject,
  onPublish,
  openLabel,
}: {
  row: KnowledgeRow;
  sources: KnowledgeSourceRow[];
  busy: boolean;
  onOpen: () => void;
  onReject: () => void;
  onPublish?: () => void;
  openLabel: string;
}) {
  const preview = queueCardPreview(row, sources);

  return (
    <div className="w-full text-left rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
      <button type="button" onClick={onOpen} className="w-full text-left space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold text-sm text-foreground leading-snug">
            {preview.title}
          </h2>
          <span className="shrink-0 text-caption font-mono uppercase tracking-wider text-muted-foreground">
            {row.status}
          </span>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed line-clamp-3">
          {preview.guidance}
        </p>
      </button>

      <dl className="grid gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
            Why it applies
          </dt>
          <dd className="text-foreground mt-0.5">
            {preview.appliesWhen
              ? `${preview.applicability} · ${preview.appliesWhen}`
              : preview.applicability}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
            Classification
          </dt>
          <dd className="text-foreground mt-0.5">
            {preview.presentationType} · {preview.classification} · {preview.trigger}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
            Sources
          </dt>
          <dd className="text-foreground mt-0.5 space-y-1">
            {preview.authoritativeSources.length === 0 ? (
              <span>No authoritative sources linked</span>
            ) : (
              preview.authoritativeSources.slice(0, 2).map((s) => (
                <div key={s.url || s.title}>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-muted-foreground">
                    {[s.publisher, s.authorityType].filter(Boolean).join(" · ")}
                    {s.lastCheckedLabel ? ` · Last checked ${s.lastCheckedLabel}` : ""}
                  </p>
                </div>
              ))
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
            Review checks
          </dt>
          <dd className="mt-1 space-y-1">
            {preview.checks.slice(0, 6).map((c) => (
              <div key={c.id} className="flex gap-2">
                <span className={cn("w-20 shrink-0", checkTone(c.status))}>
                  {statusLabel(c.status)}
                </span>
                <span className="text-muted-foreground">{c.label}</span>
              </div>
            ))}
            {row.status === "verified" && !preview.publicationReady && (
              <p className="text-amber-700 dark:text-amber-400 pt-1">
                Not ready to publish —{" "}
                {preview.blockingPublish.map((c) => c.label).join(", ") || "checks incomplete"}
              </p>
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          className="shadow-primary-btn border-0"
          disabled={busy}
          onClick={onOpen}
        >
          {openLabel}
        </Button>
        {row.status === "verified" && onPublish && preview.publicationReady && (
          <Button
            size="sm"
            variant="outline"
            className="border-0 btn-neomorphic"
            disabled={busy}
            onClick={onPublish}
          >
            Publish
          </Button>
        )}
        {(row.status === "candidate" || row.status === "verified") && (
          <Button
            size="sm"
            variant="outline"
            className="border-0 btn-neomorphic"
            disabled={busy}
            onClick={onReject}
          >
            {row.status === "verified" ? "Return to review" : "Reject"}
          </Button>
        )}
      </div>
    </div>
  );
}

function MetricChip({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-card/80 shadow-e1 px-3 py-2 min-w-[8rem]">
      <p className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums text-foreground mt-0.5">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export default function AdminKnowledgeQueue() {
  const [tab, setTab] = useState<AdminKnowledgeTab>("add");
  const [addSubTab, setAddSubTab] = useState<AddSubTab>("add");
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data, isLoading, error } = useAdminKnowledgeQueue([
    "candidate",
    "verified",
    "published",
    "stale",
  ]);
  const metricsQuery = useAdminKnowledgeMetrics();
  const setStatus = useAdminSetKnowledgeStatus();

  const ids = useMemo(() => (data ?? []).map((r) => r.id), [data]);
  const sourcesQuery = useAdminKnowledgeSources(ids);
  const sourcesByKnowledge = useMemo(() => {
    const map = new Map<string, KnowledgeSourceRow[]>();
    for (const s of sourcesQuery.data ?? []) {
      const list = map.get(s.knowledge_id) ?? [];
      list.push(s);
      map.set(s.knowledge_id, list);
    }
    return map;
  }, [sourcesQuery.data]);

  const reviewRows = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (r.status === "published" || r.status === "archived") return false;
      if (r.status === "candidate" || r.status === "stale") return true;
      if (r.status !== "verified") return true;
      const checksReady = isPublicationReady(
        r,
        queueCardPreview(r, sourcesByKnowledge.get(r.id) ?? []).checks
      );
      return !checksReady;
    });
  }, [data, sourcesByKnowledge]);

  const publishingRows = useMemo(() => {
    return (data ?? []).filter(
      (r) =>
        r.status === "verified" &&
        isPublicationReady(r, queueCardPreview(r, sourcesByKnowledge.get(r.id) ?? []).checks)
    );
  }, [data, sourcesByKnowledge]);

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
        onSuccess: () =>
          toast.success(
            status === "verified"
              ? "Verified — ready to publish"
              : status === "published"
                ? "Published"
                : status === "archived"
                  ? "Rejected"
                  : status === "candidate"
                    ? "Returned to review"
                    : `Status → ${status}`
          ),
        onError: (e) => {
          const msg = e instanceof Error ? e.message : "Update failed";
          toast.error(gateErrorMessage(msg));
        },
      }
    );
  };

  const tabs: { id: AdminKnowledgeTab; label: string }[] = [
    { id: "add", label: "Add Knowledge" },
    { id: "review", label: "Review" },
    { id: "publishing", label: "Ready to publish" },
    { id: "content", label: "Outputs" },
    { id: "metrics", label: "Overview" },
  ];

  const addSubs: { id: AddSubTab; label: string }[] = [
    { id: "add", label: "Add" },
    { id: "gaps", label: "Gaps" },
    { id: "update", label: "Update" },
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
            Add what Filla should know, close gaps, watch for change — then review, publish, and
            use it.
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

      <AdminAiBatchJobsBanner />

      {tab === "add" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {addSubs.map((s) => (
              <Button
                key={s.id}
                size="sm"
                variant={addSubTab === s.id ? "default" : "outline"}
                className={cn(
                  "border-0 h-8 text-xs",
                  addSubTab === s.id ? "shadow-primary-btn" : "btn-neomorphic"
                )}
                onClick={() => setAddSubTab(s.id)}
              >
                {s.label}
              </Button>
            ))}
          </div>
          {addSubTab === "add" && <AdminKnowledgeIntakePanel />}
          {addSubTab === "gaps" && (
            <AdminKnowledgeGapsPanel rows={(data ?? []) as KnowledgeRow[]} />
          )}
          {addSubTab === "update" && (
            <AdminKnowledgeUpdatesPanel
              rows={(data ?? []) as KnowledgeRow[]}
              sourcesByKnowledge={sourcesByKnowledge}
            />
          )}
        </div>
      )}

      {tab === "content" && <AdminContentTreePanel />}

      {tab === "metrics" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <MetricChip
              label="Verified of created"
              value={`${totals.verified} of ${totals.created}`}
            />
            <MetricChip
              label="Reused"
              value={totals.reused}
              hint={totals.reused === 0 ? "Not yet in product experiences" : undefined}
            />
            <MetricChip
              label="Answered"
              value={totals.answered}
              hint={totals.answered === 0 ? "No Assistant citations yet" : undefined}
            />
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

      <div
        className="space-y-8"
        hidden={tab !== "review"}
        ref={(node) => {
          if (node) node.inert = tab !== "review";
        }}
      >
        <section className="space-y-3">
          <div>
            <h2 className="font-medium text-sm">Review</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Guidance, claims, critic, and human verification. Newly added candidates appear here.
            </p>
          </div>
          {error && (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load queue"}
            </p>
          )}
          <AdminKnowledgeReviewWorkbench
            rows={reviewRows}
            sourcesByKnowledge={sourcesByKnowledge}
            isLoading={isLoading}
            onOpen={(id) => setDetailId(id)}
          />
        </section>
      </div>

      {tab === "publishing" && (
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
          {!isLoading && publishingRows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing ready to publish. Verify candidates with all checks passing first.
            </p>
          )}
          {publishingRows.map((row) => (
            <QueueCard
              key={row.id}
              row={row}
              sources={sourcesByKnowledge.get(row.id) ?? []}
              busy={setStatus.isPending}
              onOpen={() => setDetailId(row.id)}
              openLabel="View review"
              onReject={() => handleStatus(row.id, "candidate")}
              onPublish={() => handleStatus(row.id, "published")}
            />
          ))}
        </div>
      )}

      <AdminKnowledgeDetailSheet
        knowledgeId={detailId}
        open={Boolean(detailId)}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      />
    </div>
  );
}
