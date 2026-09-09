/**
 * Knowledge coverage matrix (scaffold).
 * Dimensions: topic × jurisdiction (v1). Future: property type × audience × applicability depth.
 * Does not invent topics — derives from existing Knowledge titles/categories.
 */

import type { KnowledgeRow } from "@/types/knowledge";
import { attrString, parseApplicability } from "@/lib/knowledge/knowledgePresentation";

export type CoverageCellStatus = "covered" | "partial" | "missing";

export type CoverageCell = {
  status: CoverageCellStatus;
  knowledgeIds: string[];
  label: string;
};

export type CoverageTopic = {
  key: string;
  label: string;
};

export type CoverageMatrix = {
  topics: CoverageTopic[];
  jurisdictions: string[];
  cells: Record<string, Record<string, CoverageCell>>;
};

export type ResearchGapItem = {
  id: string;
  priority: "high" | "medium" | "low";
  topic: string;
  jurisdiction: string;
  reason: string;
  status: CoverageCellStatus;
  knowledgeIds: string[];
};

export type ResearchableGapInput = {
  id: string;
  topic_key: string;
  topic: string;
  jurisdiction: string;
  status: "missing" | "partial";
};

/** Keep in lockstep with supabase/functions/_shared/knowledgeGapResearch.ts */
export const MAX_RESEARCH_GAPS = 20;

export function coverageGapId(topicKey: string, jurisdiction: string): string {
  return `${topicKey}::${jurisdiction}`;
}

export function parseCoverageGapId(
  id: string
): { topicKey: string; jurisdiction: string } | null {
  const idx = id.indexOf("::");
  if (idx <= 0 || idx >= id.length - 1) return null;
  return { topicKey: id.slice(0, idx), jurisdiction: id.slice(idx + 2) };
}

export function isResearchableStatus(status: CoverageCellStatus): boolean {
  return status === "missing" || status === "partial";
}

export function researchableIdsForTopic(
  matrix: CoverageMatrix,
  topicKey: string,
  jurisdictions: string[]
): string[] {
  return jurisdictions
    .filter((j) => isResearchableStatus(matrix.cells[topicKey]?.[j]?.status ?? "missing"))
    .map((j) => coverageGapId(topicKey, j));
}

export function researchableIdsForJurisdiction(
  matrix: CoverageMatrix,
  jurisdiction: string,
  topics: CoverageTopic[]
): string[] {
  return topics
    .filter((topic) =>
      isResearchableStatus(matrix.cells[topic.key]?.[jurisdiction]?.status ?? "missing")
    )
    .map((topic) => coverageGapId(topic.key, jurisdiction));
}

export function researchGapsFromIds(
  matrix: CoverageMatrix,
  ids: Iterable<string>
): ResearchableGapInput[] {
  const wanted = new Set(ids);
  const out: ResearchableGapInput[] = [];
  for (const item of researchQueueFromCoverage(matrix)) {
    if (!wanted.has(item.id) || !isResearchableStatus(item.status)) continue;
    const parsed = parseCoverageGapId(item.id);
    out.push({
      id: item.id,
      topic_key: parsed?.topicKey ?? item.id,
      topic: item.topic,
      jurisdiction: item.jurisdiction,
      status: item.status === "partial" ? "partial" : "missing",
    });
  }
  return out;
}

function topicKeyFromRow(row: KnowledgeRow): { key: string; label: string } {
  const category = attrString(row.attributes, "category")?.trim();
  if (category && category.length >= 3) {
    const key = category.toLowerCase().replace(/\s+/g, "_").slice(0, 48);
    return { key, label: category };
  }
  const title = (row.title || "Untitled").trim();
  // Prefer first meaningful phrase before em dash / hyphen jurisdiction cues.
  const head = title.split(/\s+[—–-]\s+/)[0]?.trim() || title;
  const key = head
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return { key: key || "topic", label: head.slice(0, 80) };
}

function jurisdictionsForRow(row: KnowledgeRow): string[] {
  const app = parseApplicability(row.applicability);
  if (app.unscoped) return ["Unscoped / general"];
  if (app.jurisdictions.length === 0) return ["Unspecified"];
  return app.jurisdictions.map((j) => j.trim()).filter(Boolean);
}

function cellStatus(rows: KnowledgeRow[]): CoverageCellStatus {
  if (rows.length === 0) return "missing";
  const publishedOrVerified = rows.some(
    (r) => r.status === "published" || r.status === "verified"
  );
  if (publishedOrVerified) return "covered";
  return "partial";
}

function cellLabel(status: CoverageCellStatus): string {
  switch (status) {
    case "covered":
      return "✓";
    case "partial":
      return "Partial";
    default:
      return "Missing";
  }
}

/** Build topic × jurisdiction coverage from current Knowledge rows. */
export function buildKnowledgeCoverageMatrix(rows: KnowledgeRow[]): CoverageMatrix {
  const topicMap = new Map<string, CoverageTopic>();
  const jurisdictionSet = new Set<string>();
  const bucket = new Map<string, Map<string, KnowledgeRow[]>>();

  for (const row of rows) {
    if (row.status === "archived") continue;
    const topic = topicKeyFromRow(row);
    topicMap.set(topic.key, topic);
    const jurisdictions = jurisdictionsForRow(row);
    for (const j of jurisdictions) {
      jurisdictionSet.add(j);
      if (!bucket.has(topic.key)) bucket.set(topic.key, new Map());
      const byJ = bucket.get(topic.key)!;
      const list = byJ.get(j) ?? [];
      list.push(row);
      byJ.set(j, list);
    }
  }

  const topics = [...topicMap.values()].sort((a, b) => a.label.localeCompare(b.label));
  const jurisdictions = [...jurisdictionSet].sort((a, b) => a.localeCompare(b));
  const cells: CoverageMatrix["cells"] = {};

  for (const topic of topics) {
    cells[topic.key] = {};
    for (const j of jurisdictions) {
      const list = bucket.get(topic.key)?.get(j) ?? [];
      const status = cellStatus(list);
      cells[topic.key][j] = {
        status,
        knowledgeIds: list.map((r) => r.id),
        label: cellLabel(status),
      };
    }
  }

  return { topics, jurisdictions, cells };
}

export function researchQueueFromCoverage(matrix: CoverageMatrix): ResearchGapItem[] {
  const items: ResearchGapItem[] = [];
  for (const topic of matrix.topics) {
    for (const j of matrix.jurisdictions) {
      if (j === "Unspecified") continue;
      const cell = matrix.cells[topic.key]?.[j];
      if (!cell || cell.status === "covered") continue;
      const coveredElsewhere = matrix.jurisdictions.some((other) => {
        if (other === j) return false;
        return matrix.cells[topic.key]?.[other]?.status === "covered";
      });
      const priority: ResearchGapItem["priority"] =
        cell.status === "missing" && coveredElsewhere
          ? "high"
          : cell.status === "missing"
            ? "high"
            : "medium";
      items.push({
        id: `${topic.key}::${j}`,
        priority,
        topic: topic.label,
        jurisdiction: j,
        status: cell.status,
        knowledgeIds: cell.knowledgeIds,
        reason:
          cell.status === "missing"
            ? coveredElsewhere
              ? "Covered in other jurisdictions — jurisdictional gap"
              : "No Knowledge for this topic × jurisdiction"
            : "Candidates exist but not yet verified/published",
      });
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return items.sort((a, b) => rank[a.priority] - rank[b.priority] || a.topic.localeCompare(b.topic));
}

export function coverageSummary(matrix: CoverageMatrix): {
  topics: number;
  jurisdictions: number;
  covered: number;
  partial: number;
  missing: number;
  cells: number;
} {
  let covered = 0;
  let partial = 0;
  let missing = 0;
  let cells = 0;
  for (const topic of matrix.topics) {
    for (const j of matrix.jurisdictions) {
      cells += 1;
      const status = matrix.cells[topic.key]?.[j]?.status ?? "missing";
      if (status === "covered") covered += 1;
      else if (status === "partial") partial += 1;
      else missing += 1;
    }
  }
  return {
    topics: matrix.topics.length,
    jurisdictions: matrix.jurisdictions.length,
    covered,
    partial,
    missing,
    cells,
  };
}
