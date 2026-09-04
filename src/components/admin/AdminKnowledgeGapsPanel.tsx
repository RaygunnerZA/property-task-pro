import { useMemo } from "react";
import type { KnowledgeRow } from "@/types/knowledge";
import {
  buildKnowledgeCoverageMatrix,
  coverageSummary,
  researchQueueFromCoverage,
  type CoverageCellStatus,
} from "@/lib/knowledge/knowledgeCoverage";
import { cn } from "@/lib/utils";

function cellTone(status: CoverageCellStatus): string {
  switch (status) {
    case "covered":
      return "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10";
    case "partial":
      return "text-amber-800 dark:text-amber-300 bg-amber-500/10";
    default:
      return "text-muted-foreground bg-muted/40";
  }
}

function priorityTone(priority: "high" | "medium" | "low"): string {
  switch (priority) {
    case "high":
      return "text-destructive";
    case "medium":
      return "text-amber-700 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

type Props = {
  rows: KnowledgeRow[];
};

export function AdminKnowledgeGapsPanel({ rows }: Props) {
  const matrix = useMemo(() => buildKnowledgeCoverageMatrix(rows), [rows]);
  const summary = useMemo(() => coverageSummary(matrix), [matrix]);
  const queue = useMemo(() => researchQueueFromCoverage(matrix).slice(0, 40), [matrix]);

  const displayJurisdictions = matrix.jurisdictions.filter((j) => j !== "Unspecified").slice(0, 12);
  const displayTopics = matrix.topics.slice(0, 24);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-medium text-sm">Gaps</h2>
        <p className="text-xs text-muted-foreground max-w-3xl">
          Coverage of what Filla already knows versus what is missing. v1 scores{" "}
          <span className="text-foreground/80">topic × jurisdiction</span> from live Knowledge.
          Deeper axes (property type, audience, claim completeness) and market-expansion programmes
          land next. Content evidence gaps should feed this same queue — not a separate dead-end.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Chip label="Topics" value={summary.topics} />
        <Chip label="Jurisdictions" value={summary.jurisdictions} />
        <Chip label="Covered cells" value={summary.covered} />
        <Chip label="Partial" value={summary.partial} />
        <Chip label="Missing" value={summary.missing} />
      </div>

      {displayTopics.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No Knowledge rows yet — Add sources first, then coverage appears here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-card/80 shadow-e1">
          <table className="w-full text-left text-xs border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-border/40">
                <th className="p-3 font-mono uppercase tracking-wider text-[10px] text-muted-foreground sticky left-0 bg-card/95">
                  Topic
                </th>
                {displayJurisdictions.map((j) => (
                  <th
                    key={j}
                    className="p-3 font-mono uppercase tracking-wider text-[10px] text-muted-foreground whitespace-nowrap"
                  >
                    {j}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayTopics.map((topic) => (
                <tr key={topic.key} className="border-b border-border/20">
                  <td className="p-3 font-medium sticky left-0 bg-card/95 max-w-[14rem]">
                    <span className="line-clamp-2">{topic.label}</span>
                  </td>
                  {displayJurisdictions.map((j) => {
                    const cell = matrix.cells[topic.key]?.[j] ?? {
                      status: "missing" as const,
                      label: "Missing",
                      knowledgeIds: [],
                    };
                    return (
                      <td key={j} className="p-2">
                        <span
                          className={cn(
                            "inline-flex rounded-md px-2 py-1 text-[11px]",
                            cellTone(cell.status)
                          )}
                        >
                          {cell.label}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {(matrix.topics.length > displayTopics.length ||
            matrix.jurisdictions.length > displayJurisdictions.length) && (
            <p className="p-3 text-[11px] text-muted-foreground border-t border-border/30">
              Showing {displayTopics.length} of {matrix.topics.length} topics ·{" "}
              {displayJurisdictions.length} of {matrix.jurisdictions.length} jurisdictions
            </p>
          )}
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Research queue
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prioritised gaps. Priority will later combine regulatory importance, risk, affected
            properties, and adjacent-jurisdiction completeness.
          </p>
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open gaps in the current matrix.</p>
        ) : (
          <ul className="space-y-2">
            {queue.map((item) => (
              <li
                key={item.id}
                className="rounded-xl bg-card/80 shadow-e1 p-3 space-y-1"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={cn(
                      "text-[10px] font-mono uppercase tracking-wider",
                      priorityTone(item.priority)
                    )}
                  >
                    {item.priority} priority
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {item.jurisdiction} · {item.topic}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{item.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-card/80 shadow-e1 px-3 py-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
