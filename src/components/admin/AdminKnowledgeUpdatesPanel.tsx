import { useMemo } from "react";
import type { KnowledgeRow } from "@/types/knowledge";
import type { KnowledgeSourceRow } from "@/hooks/admin/useAdminKnowledge";
import { computeSourceHealth } from "@/lib/knowledge/knowledgePresentation";

type Props = {
  rows: KnowledgeRow[];
  sourcesByKnowledge: Map<string, KnowledgeSourceRow[]>;
};

/**
 * UPDATE hub — monitors sources behind published Knowledge.
 * Detection bots do not rewrite verified Knowledge; they create update candidates.
 */
export function AdminKnowledgeUpdatesPanel({ rows, sourcesByKnowledge }: Props) {
  const monitored = useMemo(() => {
    return rows
      .filter((r) => r.status === "published" || r.status === "verified")
      .map((row) => {
        const sources = sourcesByKnowledge.get(row.id) ?? [];
        const health = computeSourceHealth(sources, row);
        return { row, health, sources };
      })
      .filter((m) => m.health.authoritative.length > 0)
      .slice(0, 40);
  }, [rows, sourcesByKnowledge]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-medium text-sm">Update</h2>
        <p className="text-xs text-muted-foreground max-w-3xl">
          Watch sources attached to verified Knowledge. When a source changes, Filla creates an{" "}
          <span className="text-foreground/80">update candidate</span> — never silently rewrite v1.
          Flow: monitor → detect → compare claims → critic → human review → new Knowledge version.
        </p>
      </div>

      <div className="rounded-xl bg-muted/25 p-4 space-y-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground text-sm">Triage outcomes (design)</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            <span className="text-foreground/90">No material change</span> — formatting/editorial
            only.
          </li>
          <li>
            <span className="text-foreground/90">Potential material change</span> — requires
            critic/review.
          </li>
          <li>
            <span className="text-foreground/90">Material change</span> — specific verified claims
            appear superseded; open claim-level comparison.
          </li>
        </ul>
        <p className="pt-1">
          Continuous source polling and claim-diff bots are not live yet. This list shows published
          Knowledge with authoritative URLs that monitors will watch.
        </p>
      </div>

      {monitored.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No verified/published Knowledge with authoritative source URLs yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {monitored.map(({ row, health }) => {
            const source = health.authoritative[0];
            return (
              <li
                key={row.id}
                className="rounded-xl bg-card/80 shadow-e1 p-3 space-y-1"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{row.title}</p>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">
                    {row.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Source · {source?.publisher || source?.title || "Authoritative URL"}
                  {source?.lastCheckedLabel ? ` · Checked ${source.lastCheckedLabel}` : ""}
                </p>
                {source?.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary truncate block hover:underline"
                  >
                    {source.url}
                  </a>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Monitor status · Not scheduled · No change candidate
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
