import { useState } from "react";
import { BookOpen, Loader2, Plus, Search, X } from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePublishedKnowledge } from "@/hooks/usePublishedKnowledge";
import {
  useOrgKnowledgeMetrics,
  useOrgKnowledgeReviewQueue,
  useSetKnowledgeStatus,
  useUpsertOrgKnowledge,
} from "@/hooks/useOrgKnowledgeReview";
import { knowledgeStatusUserLabel } from "@/lib/knowledge/knowledgeStatusLabel";
import { displayCanonicalGuidance } from "@/lib/knowledge/knowledgeReviewState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { KnowledgeRow } from "@/types/knowledge";

function formatApplicability(row: KnowledgeRow): string {
  const app = row.applicability;
  if (!app || typeof app !== "object") return "—";
  const record = app as Record<string, unknown>;
  if (record.unscoped === true) return "Global";
  const jurisdictions = Array.isArray(record.jurisdictions)
    ? (record.jurisdictions as unknown[]).map(String).filter(Boolean)
    : [];
  if (jurisdictions.length === 0) return "Jurisdiction not set";
  return jurisdictions.join(" · ");
}

function KnowledgeCard({
  row,
  onOpen,
}: {
  row: KnowledgeRow;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-xl bg-card/80 shadow-e1 p-4 space-y-2 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium leading-snug">{row.title}</h3>
        <span className="shrink-0 text-caption font-mono uppercase tracking-wider text-muted-foreground">
          {knowledgeStatusUserLabel(row.status)}
        </span>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-3">
        {displayCanonicalGuidance(row)}
      </p>
      <p className="text-xs text-muted-foreground">{formatApplicability(row)}</p>
    </button>
  );
}

export default function Knowledge() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<KnowledgeRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");

  const { data, isLoading, error } = usePublishedKnowledge(query);
  const { data: reviewQueue, canReview, isLoading: reviewLoading } =
    useOrgKnowledgeReviewQueue();
  const { data: metrics } = useOrgKnowledgeMetrics();
  const setStatus = useSetKnowledgeStatus();
  const upsertOrg = useUpsertOrgKnowledge();

  const clearSearch = () => {
    setSearch("");
    setQuery("");
  };

  const submitGuidance = () => {
    const title = newTitle.trim();
    const summary = newSummary.trim();
    if (title.length < 3) {
      toast.error("Title is required");
      return;
    }
    if (summary.length < 12) {
      toast.error("Add a short guidance summary");
      return;
    }
    upsertOrg.mutate(
      { title, summary },
      {
        onSuccess: () => {
          toast.success("Added to organisation review queue");
          setNewTitle("");
          setNewSummary("");
          setAddOpen(false);
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Could not create guidance"),
      }
    );
  };

  return (
    <StandardPage
      title="Knowledge"
      icon={<BookOpen className="h-6 w-6" />}
      subtitle="Verified policies, playbooks, and guidance for your organisation."
    >
      <div className="space-y-8">
        {metrics && (
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["Created", metrics.knowledge_created],
                ["Verified", metrics.knowledge_verified],
                ["Reused", metrics.knowledge_reused],
                ["Answered", metrics.questions_answered],
                ["Automation", metrics.automation_created],
                ["Time saved", `${Math.round(Number(metrics.time_saved_minutes || 0))}m`],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl bg-card/80 shadow-e1 px-3 py-2 min-w-[6.5rem]"
              >
                <p className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className="text-base font-semibold tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setQuery(search.trim());
              }}
              placeholder="Search published knowledge…"
              className="pl-9 border-0 shadow-engraved bg-input"
            />
          </div>
          <Button
            className="shadow-primary-btn border-0"
            onClick={() => setQuery(search.trim())}
          >
            Search
          </Button>
          {query && (
            <Button
              variant="outline"
              className="border-0 btn-neomorphic"
              onClick={clearSearch}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          {canReview && (
            <Button
              variant="outline"
              className="border-0 btn-neomorphic"
              onClick={() => setAddOpen((o) => !o)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add guidance
            </Button>
          )}
        </div>

        {canReview && addOpen && (
          <section className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-3">
            <h2 className="text-sm font-medium">Add organisation guidance</h2>
            <p className="text-xs text-muted-foreground">
              Creates a candidate in your review queue. It will not publish until verified.
            </p>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
              className="border-0 shadow-engraved bg-input"
            />
            <Textarea
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder="Homeowner-readable guidance (one or two sentences)…"
              rows={3}
              className="border-0 shadow-engraved bg-input resize-none"
            />
            <div className="flex gap-2">
              <Button
                className="shadow-primary-btn border-0"
                disabled={upsertOrg.isPending}
                onClick={submitGuidance}
              >
                {upsertOrg.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Save to review queue
              </Button>
              <Button
                variant="ghost"
                onClick={() => setAddOpen(false)}
                disabled={upsertOrg.isPending}
              >
                Cancel
              </Button>
            </div>
          </section>
        )}

        {canReview && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Organisation review queue</h2>
            {reviewLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            {!reviewLoading && (reviewQueue?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                No candidates awaiting review.
              </p>
            )}
            <div className="space-y-2">
              {(reviewQueue ?? []).map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    "rounded-xl bg-card/80 shadow-e1 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium truncate">{row.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {displayCanonicalGuidance(row)}
                    </p>
                    <p className="text-caption font-mono uppercase text-muted-foreground">
                      {knowledgeStatusUserLabel(row.status)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {row.status !== "verified" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-0 btn-neomorphic"
                        disabled={setStatus.isPending}
                        onClick={() =>
                          setStatus.mutate(
                            { knowledgeId: row.id, status: "verified" },
                            {
                              onSuccess: () => toast.success("Verified"),
                              onError: (e) =>
                                toast.error(
                                  e instanceof Error ? e.message : "Failed"
                                ),
                            }
                          )
                        }
                      >
                        Verify
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="shadow-primary-btn border-0"
                      disabled={setStatus.isPending}
                      onClick={() =>
                        setStatus.mutate(
                          { knowledgeId: row.id, status: "published" },
                          {
                            onSuccess: () => toast.success("Published"),
                            onError: (e) =>
                              toast.error(
                                e instanceof Error ? e.message : "Failed"
                              ),
                          }
                        )
                      }
                    >
                      Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-0 btn-neomorphic"
                      disabled={setStatus.isPending}
                      onClick={() =>
                        setStatus.mutate(
                          { knowledgeId: row.id, status: "archived" },
                          {
                            onSuccess: () => toast.success("Archived"),
                            onError: (e) =>
                              toast.error(
                                e instanceof Error ? e.message : "Failed"
                              ),
                          }
                        )
                      }
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Published knowledge</h2>
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load knowledge"}
            </p>
          )}
          {!isLoading && !error && (data?.length ?? 0) === 0 && (
            <div className="rounded-xl bg-card/70 p-6 shadow-e1 text-sm text-muted-foreground space-y-2">
              {query ? (
                <>
                  <p>No matches for “{query}”.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-0 btn-neomorphic"
                    onClick={clearSearch}
                  >
                    Clear search
                  </Button>
                </>
              ) : (
                <p>No published knowledge yet. Verified guidance will appear here.</p>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {(data ?? []).map((row) => (
              <KnowledgeCard
                key={row.id}
                row={row}
                onOpen={() => setDetail(row)}
              />
            ))}
          </div>
        </section>
      </div>

      <Sheet open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.title}</SheetTitle>
                <SheetDescription>
                  {knowledgeStatusUserLabel(detail.status)}
                  {detail.scope === "platform" ? " · Platform" : " · Organisation"}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4 text-sm">
                <div>
                  <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
                    Guidance
                  </p>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                    {displayCanonicalGuidance(detail)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
                    Applicability
                  </p>
                  <p className="text-muted-foreground">{formatApplicability(detail)}</p>
                </div>
                {detail.body && detail.summary && detail.body.trim() !== detail.summary.trim() && (
                  <div>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mb-1">
                      Detail
                    </p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{detail.body}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </StandardPage>
  );
}
