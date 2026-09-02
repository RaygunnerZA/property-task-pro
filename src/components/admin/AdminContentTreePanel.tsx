import { useEffect, useState } from "react";
import { GitBranch, Loader2 } from "lucide-react";
import {
  useAdminContentTopic,
  useAdminContentTopics,
  useAdminCreateContentTopic,
  useAdminKnowledgeQueue,
  useAdminSetContentOutputStatus,
  useAdminUpsertContentOutput,
  useAdminUpsertContentTopicStage,
} from "@/hooks/admin/useAdminKnowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  ContentOutputKind,
  ContentOutputRow,
  ContentOutputStatus,
  KnowledgeRow,
} from "@/types/knowledge";
import { toast } from "sonner";

const OUTPUT_LABELS: Record<ContentOutputKind, string> = {
  core_article: "Core article",
  faq: "FAQ",
  in_app_tip: "In-app tip",
};

export function AdminContentTreePanel() {
  const topicsQuery = useAdminContentTopics();
  const createTopic = useAdminCreateContentTopic();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailQuery = useAdminContentTopic(selectedId);
  const upsertStage = useAdminUpsertContentTopicStage();
  const upsertOutput = useAdminUpsertContentOutput();
  const setOutputStatus = useAdminSetContentOutputStatus();

  const verifiedQueue = useAdminKnowledgeQueue(["verified", "published"]);
  const [linkKnowledgeId, setLinkKnowledgeId] = useState("");

  const topic = detailQuery.data?.topic;
  const outputs = detailQuery.data?.outputs ?? [];
  const knowledge = detailQuery.data?.knowledge;

  const [seoPrimary, setSeoPrimary] = useState("");
  const [seoSecondary, setSeoSecondary] = useState("");
  const [seoIntent, setSeoIntent] = useState("");
  const [briefAngle, setBriefAngle] = useState("");
  const [briefTitle, setBriefTitle] = useState("");
  const [briefCta, setBriefCta] = useState("");
  const [briefSections, setBriefSections] = useState("");
  const [briefQuestions, setBriefQuestions] = useState("");

  useEffect(() => {
    if (!topic) return;
    const seo = (topic.seo ?? {}) as Record<string, unknown>;
    const brief = (topic.brief ?? {}) as Record<string, unknown>;
    setSeoPrimary(String(seo.primary_keyword ?? ""));
    setSeoSecondary(
      Array.isArray(seo.secondary_keywords) ? (seo.secondary_keywords as string[]).join(", ") : ""
    );
    setSeoIntent(String(seo.search_intent ?? ""));
    setBriefAngle(String(brief.angle ?? ""));
    setBriefTitle(String(brief.title ?? ""));
    setBriefCta(String(brief.cta ?? ""));
    setBriefSections(
      Array.isArray(brief.sections) ? (brief.sections as string[]).join("\n") : ""
    );
    setBriefQuestions(
      Array.isArray(brief.questions) ? (brief.questions as string[]).join("\n") : ""
    );
  }, [topic?.id, topic?.updated_at]);

  const platformVerified = (verifiedQueue.data ?? []).filter(
    (k: KnowledgeRow) => k.scope === "platform"
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-primary" />
          <h2 className="font-medium text-sm">Content topics</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Knowledge → SEO → Brief → Core article / FAQ / In-app tip. Stages 5–6
          (Creative and Publishing) are intentional stubs — no generation or channel
          integrations in this release.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs space-y-1 flex-1 min-w-[12rem]">
            <span className="text-muted-foreground">Verified / published platform Knowledge</span>
            <select
              className="w-full rounded-md bg-muted/50 px-2 py-2 text-sm"
              value={linkKnowledgeId}
              onChange={(e) => setLinkKnowledgeId(e.target.value)}
            >
              <option value="">Select knowledge…</option>
              {platformVerified.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.title}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            className="shadow-primary-btn border-0"
            disabled={!linkKnowledgeId || createTopic.isPending}
            onClick={() =>
              createTopic.mutate(
                { knowledgeId: linkKnowledgeId },
                {
                  onSuccess: (row) => {
                    toast.success("Content topic created");
                    setSelectedId(row.id);
                    setLinkKnowledgeId("");
                  },
                  onError: (e) =>
                    toast.error(e instanceof Error ? e.message : "Create topic failed"),
                }
              )
            }
          >
            {createTopic.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            New topic
          </Button>
        </div>

        <div className="space-y-2">
          {(topicsQuery.data ?? []).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                selectedId === t.id ? "bg-primary/10" : "bg-muted/30 hover:bg-muted/50"
              }`}
            >
              <span className="font-medium">{t.title}</span>
              <span className="text-xs text-muted-foreground ml-2 font-mono">{t.status}</span>
            </button>
          ))}
          {!topicsQuery.isLoading && (topicsQuery.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No content topics yet.</p>
          )}
        </div>
      </section>

      {selectedId && detailQuery.isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {topic && knowledge && (
        <div className="space-y-4">
          <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-2">
            <h3 className="text-sm font-medium">1 · Knowledge</h3>
            <p className="text-sm font-semibold">{knowledge.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-3">
              {knowledge.summary || knowledge.body || "—"}
            </p>
            <p className="text-xs font-mono text-muted-foreground">
              {knowledge.status} · v{knowledge.version}
            </p>
          </section>

          <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
            <h3 className="text-sm font-medium">2 · SEO opportunity</h3>
            <Input
              placeholder="Primary keyword"
              value={seoPrimary}
              onChange={(e) => setSeoPrimary(e.target.value)}
            />
            <Input
              placeholder="Secondary keywords (comma-separated)"
              value={seoSecondary}
              onChange={(e) => setSeoSecondary(e.target.value)}
            />
            <Input
              placeholder="Search intent"
              value={seoIntent}
              onChange={(e) => setSeoIntent(e.target.value)}
            />
            <Button
              size="sm"
              className="shadow-primary-btn border-0"
              disabled={upsertStage.isPending}
              onClick={() =>
                upsertStage.mutate(
                  {
                    topicId: topic.id,
                    seo: {
                      primary_keyword: seoPrimary,
                      secondary_keywords: seoSecondary
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      search_intent: seoIntent,
                    },
                  },
                  {
                    onSuccess: () => toast.success("SEO saved"),
                    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
                  }
                )
              }
            >
              Save SEO
            </Button>
          </section>

          <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
            <h3 className="text-sm font-medium">3 · Editorial brief</h3>
            <Input
              placeholder="Angle"
              value={briefAngle}
              onChange={(e) => setBriefAngle(e.target.value)}
            />
            <Input
              placeholder="Working title"
              value={briefTitle}
              onChange={(e) => setBriefTitle(e.target.value)}
            />
            <Textarea
              placeholder="Sections (one per line)"
              value={briefSections}
              onChange={(e) => setBriefSections(e.target.value)}
              rows={3}
            />
            <Textarea
              placeholder="Questions to answer (one per line)"
              value={briefQuestions}
              onChange={(e) => setBriefQuestions(e.target.value)}
              rows={3}
            />
            <Input
              placeholder="CTA"
              value={briefCta}
              onChange={(e) => setBriefCta(e.target.value)}
            />
            <Button
              size="sm"
              className="shadow-primary-btn border-0"
              disabled={upsertStage.isPending}
              onClick={() =>
                upsertStage.mutate(
                  {
                    topicId: topic.id,
                    brief: {
                      angle: briefAngle,
                      title: briefTitle,
                      sections: briefSections
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      questions: briefQuestions
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      cta: briefCta,
                    },
                  },
                  {
                    onSuccess: () => toast.success("Brief saved"),
                    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
                  }
                )
              }
            >
              Save brief
            </Button>
          </section>

          <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-4">
            <h3 className="text-sm font-medium">4 · Outputs</h3>
            {outputs.map((o) => (
              <OutputEditor
                key={o.id}
                row={o}
                busy={upsertOutput.isPending || setOutputStatus.isPending}
                onSave={(title, body) =>
                  upsertOutput.mutate(
                    {
                      topicId: topic.id,
                      outputKind: o.output_kind,
                      title,
                      body,
                      status: o.status === "approved" ? "draft" : undefined,
                    },
                    {
                      onSuccess: () => toast.success("Output saved"),
                      onError: (e) =>
                        toast.error(e instanceof Error ? e.message : "Save failed"),
                    }
                  )
                }
                onStatus={(status) =>
                  setOutputStatus.mutate(
                    { outputId: o.id, status, topicId: topic.id },
                    {
                      onSuccess: () => toast.success(`Output → ${status}`),
                      onError: (e) =>
                        toast.error(e instanceof Error ? e.message : "Status failed"),
                    }
                  )
                }
              />
            ))}
          </section>

          <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-2 opacity-70">
            <h3 className="text-sm font-medium">5–6 · Creative · Publishing</h3>
            <p className="text-xs text-muted-foreground">
              Intentional stubs only. No creative asset production, scheduling, or external
              publish channels until Phase 3 (see @Docs/32). Manual Outputs above remain the
              working path.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function OutputEditor({
  row,
  busy,
  onSave,
  onStatus,
}: {
  row: ContentOutputRow;
  busy: boolean;
  onSave: (title: string, body: string) => void;
  onStatus: (status: ContentOutputStatus) => void;
}) {
  const [title, setTitle] = useState(row.title ?? "");
  const [body, setBody] = useState(row.body ?? "");

  useEffect(() => {
    setTitle(row.title ?? "");
    setBody(row.body ?? "");
  }, [row.id, row.updated_at]);

  return (
    <div className="rounded-lg bg-muted/20 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{OUTPUT_LABELS[row.output_kind]}</p>
        <span className="text-xs font-mono uppercase text-muted-foreground">{row.status}</span>
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Markdown / plain text"
        rows={row.output_kind === "core_article" ? 8 : 4}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="shadow-primary-btn border-0"
          disabled={busy}
          onClick={() => onSave(title, body)}
        >
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          disabled={busy}
          onClick={() => onStatus("needs_review")}
        >
          Needs review
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          disabled={busy}
          onClick={() => onStatus("approved")}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic"
          disabled={busy}
          onClick={() => onStatus("rejected")}
        >
          Reject
        </Button>
      </div>
      {row.status === "approved" && (
        <p className="text-xs text-muted-foreground">
          Saving approved content moves it to draft first — approved bodies are not silently
          overwritten.
        </p>
      )}
    </div>
  );
}
