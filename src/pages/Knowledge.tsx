import { useState } from "react";
import { BookOpen, Loader2, Search } from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePublishedKnowledge } from "@/hooks/usePublishedKnowledge";
import {
  useOrgKnowledgeMetrics,
  useOrgKnowledgeReviewQueue,
  useSetKnowledgeStatus,
} from "@/hooks/useOrgKnowledgeReview";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { KnowledgeRow } from "@/types/knowledge";

function KnowledgeCard({ row }: { row: KnowledgeRow }) {
  return (
    <article className="rounded-xl bg-card/80 shadow-e1 p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium leading-snug">{row.title}</h3>
        <span className="shrink-0 text-caption font-mono uppercase tracking-wider text-muted-foreground">
          {row.scope}
        </span>
      </div>
      {row.summary && (
        <p className="text-sm text-muted-foreground line-clamp-3">{row.summary}</p>
      )}
      {row.body && !row.summary && (
        <p className="text-sm text-muted-foreground line-clamp-3">{row.body}</p>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="font-mono uppercase tracking-wider">{row.source_kind}</span>
        {row.trust_score != null && (
          <span className="font-mono">trust {Number(row.trust_score).toFixed(2)}</span>
        )}
      </div>
    </article>
  );
}

export default function Knowledge() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { data, isLoading, error } = usePublishedKnowledge(query);
  const { data: reviewQueue, canReview, isLoading: reviewLoading } =
    useOrgKnowledgeReviewQueue();
  const { data: metrics } = useOrgKnowledgeMetrics();
  const setStatus = useSetKnowledgeStatus();

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
        <div className="flex gap-2">
          <div className="relative flex-1">
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
        </div>

        {canReview && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Organisation review queue</h2>
            {reviewLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            {!reviewLoading && (reviewQueue?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">No candidates awaiting review.</p>
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
                      {row.summary || row.body || "No summary"}
                    </p>
                    <p className="text-caption font-mono uppercase text-muted-foreground">
                      {row.status} · {row.source_kind}
                      {row.trust_score != null
                        ? ` · trust ${Number(row.trust_score).toFixed(2)}`
                        : ""}
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
                                toast.error(e instanceof Error ? e.message : "Failed"),
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
                              toast.error(e instanceof Error ? e.message : "Failed"),
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
                              toast.error(e instanceof Error ? e.message : "Failed"),
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
            <div className="rounded-xl bg-card/70 p-6 shadow-e1 text-sm text-muted-foreground">
              No published knowledge yet. Verified guidance will appear here.
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {(data ?? []).map((row) => (
              <KnowledgeCard key={row.id} row={row} />
            ))}
          </div>
        </section>
      </div>
    </StandardPage>
  );
}
