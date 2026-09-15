/**
 * Knowledge Schedule — ordered topic packages (Now / Next / Later / Monitoring).
 * Default working home for Expression; Review package opens the unified workspace.
 */
import { useMemo, useState } from "react";
import { Loader2, Pin, PinOff } from "lucide-react";
import {
  useAdminContentTopics,
  useAdminCreateContentTopic,
  useAdminGenerateContent,
  useAdminKnowledgeQueue,
  useAdminUpsertContentTopicStage,
} from "@/hooks/admin/useAdminKnowledge";
import { AdminKnowledgePackageWorkspace } from "@/components/admin/AdminKnowledgePackageWorkspace";
import { Button } from "@/components/ui/button";
import {
  buildScheduleItems,
  groupScheduleItems,
  layerReadinessLabel,
  mergeSchedulePrefsIntoPublishing,
  scheduleGroupOrder,
  SCHEDULE_GROUP_LABELS,
  type ScheduleItem,
} from "@/lib/content/knowledgeSchedule";
import { toast } from "sonner";

function ScheduleRow({
  item,
  onReview,
  onTogglePin,
  onDefer,
  pinBusy,
}: {
  item: ScheduleItem;
  onReview: () => void;
  onTogglePin: () => void;
  onDefer: () => void;
  pinBusy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-semibold text-sm text-foreground leading-snug">
              {item.topic.title}
            </h3>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {item.priorityLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.reason}</p>
        </div>
        <Button
          size="sm"
          className="shadow-primary-btn border-0 shrink-0"
          onClick={onReview}
        >
          {item.nextAction.label}
        </Button>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            International
          </p>
          <p className="mt-0.5">
            {item.international.label}
            <span className="text-muted-foreground">
              {" "}
              · {layerReadinessLabel(item.international.readiness)}
            </span>
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Regional layers
          </p>
          {item.regionalLayers.length === 0 ? (
            <p className="mt-0.5 text-muted-foreground">None</p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {item.regionalLayers.map((l) => (
                <li key={l.id}>
                  {l.label}
                  <span className="text-muted-foreground">
                    {" "}
                    · {layerReadinessLabel(l.readiness)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          {item.forms.length > 0 ? item.forms.join(" · ") : "Forms not planned yet"}
        </span>
        <span>
          Visual ·{" "}
          {item.visualReadiness === "ready"
            ? "Ready"
            : item.visualReadiness === "concept"
              ? "Concept"
              : "Not started"}
        </span>
        {item.exception && <span className="text-amber-700 dark:text-amber-400">{item.exception}</span>}
        {item.prefs.distribution_ready_at && (
          <span>Approved for distribution (not published)</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide details" : "Sources & scoring"}
        </button>
        <button
          type="button"
          className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          disabled={pinBusy}
          onClick={onTogglePin}
        >
          {item.prefs.pinned ? (
            <>
              <PinOff className="h-3 w-3" /> Unpin
            </>
          ) : (
            <>
              <Pin className="h-3 w-3" /> Pin
            </>
          )}
        </button>
        {!item.prefs.deferred && (
          <button
            type="button"
            className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
            disabled={pinBusy}
            onClick={onDefer}
          >
            Defer
          </button>
        )}
      </div>

      {expanded && (
        <div className="rounded-lg bg-muted/20 p-3 space-y-1 text-xs text-muted-foreground">
          <p>Workflow: {item.topic.workflow_status}</p>
          <p>Scope: {item.strategy.content_scope || item.topic.content_scope || "—"}</p>
          <p>
            Ranking is heuristic — pin, defer, or seasonal relevance. No AI score is shown.
          </p>
        </div>
      )}
    </article>
  );
}

export function AdminKnowledgeSchedulePanel() {
  const topicsQuery = useAdminContentTopics();
  const createTopic = useAdminCreateContentTopic();
  const generate = useAdminGenerateContent();
  const upsertStage = useAdminUpsertContentTopicStage();
  const verifiedQueue = useAdminKnowledgeQueue(["verified", "published"]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkKnowledgeId, setLinkKnowledgeId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const items = useMemo(
    () => buildScheduleItems(topicsQuery.data ?? []),
    [topicsQuery.data]
  );
  const grouped = useMemo(() => groupScheduleItems(items), [items]);

  const updatePrefs = async (
    item: ScheduleItem,
    patch: { pinned?: boolean; deferred?: boolean; reason_override?: string }
  ) => {
    try {
      const publishing = mergeSchedulePrefsIntoPublishing(item.topic.publishing, patch);
      await upsertStage.mutateAsync({
        topicId: item.topic.id,
        publishing,
      });
      toast.success(patch.pinned ? "Pinned" : patch.deferred ? "Deferred" : "Schedule updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update schedule");
    }
  };

  const createPilotTopic = async () => {
    if (!linkKnowledgeId) {
      toast.error("Select Knowledge first");
      return;
    }
    try {
      const row = await createTopic.mutateAsync({
        knowledgeId: linkKnowledgeId,
        title: undefined,
      });
      const publishing = mergeSchedulePrefsIntoPublishing(row.publishing, {
        pinned: true,
        reason_override: "Pinned for pilot",
      });
      await upsertStage.mutateAsync({ topicId: row.id, publishing });
      await generate.mutateAsync({ topicId: row.id, stage: "plan" });
      setSelectedId(row.id);
      setCreateOpen(false);
      toast.success("Topic on Schedule — review the package");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create topic");
    }
  };

  if (selectedId) {
    return (
      <AdminKnowledgePackageWorkspace
        topicId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const knowledgeOptions = (verifiedQueue.data ?? []).map((k) => ({
    id: k.id,
    title: k.title,
  }));

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Knowledge Schedule</h2>
        <p className="text-sm text-muted-foreground">
          Topic packages ordered by importance. Review a package, accept for production, then
          approve distribution when expressions are ready — channel execution stays separate.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic text-xs"
          onClick={() => setCreateOpen((v) => !v)}
        >
          {createOpen ? "Cancel" : "Add topic to schedule"}
        </Button>
      </div>

      {createOpen && (
        <div className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Link verified Knowledge. Chimney + France is the first pilot path.
          </p>
          <select
            className="w-full rounded-lg bg-muted/40 px-3 py-2 text-sm"
            value={linkKnowledgeId}
            onChange={(e) => setLinkKnowledgeId(e.target.value)}
          >
            <option value="">Select knowledge…</option>
            {knowledgeOptions.map((k) => (
              <option key={k.id} value={k.id}>
                {k.title}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="shadow-primary-btn border-0"
            disabled={createTopic.isPending || generate.isPending || !linkKnowledgeId}
            onClick={() => void createPilotTopic()}
          >
            {(createTopic.isPending || generate.isPending) && (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            )}
            Create and pin for pilot
          </Button>
        </div>
      )}

      {topicsQuery.isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {!topicsQuery.isLoading && items.length === 0 && (
        <p className="text-sm text-muted-foreground rounded-xl bg-card/80 shadow-e1 p-6">
          No topic packages yet. Add chimney and flue sweeping (international + France) to start
          the pilot.
        </p>
      )}

      {scheduleGroupOrder().map((group) => {
        const rows = grouped[group];
        if (rows.length === 0) return null;
        return (
          <section key={group} className="space-y-2">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-0.5">
              {SCHEDULE_GROUP_LABELS[group]}
              <span className="tabular-nums text-muted-foreground/80"> · {rows.length}</span>
            </h3>
            <div className="space-y-3">
              {rows.map((item) => (
                <ScheduleRow
                  key={item.topic.id}
                  item={item}
                  onReview={() => setSelectedId(item.topic.id)}
                  pinBusy={upsertStage.isPending}
                  onTogglePin={() =>
                    void updatePrefs(item, {
                      pinned: !item.prefs.pinned,
                      reason_override: !item.prefs.pinned ? "Pinned for pilot" : "",
                    })
                  }
                  onDefer={() =>
                    void updatePrefs(item, {
                      deferred: true,
                      pinned: false,
                      reason_override: "Deferred by administrator",
                    })
                  }
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
