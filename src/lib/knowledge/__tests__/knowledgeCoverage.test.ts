import { describe, expect, it } from "vitest";
import {
  buildKnowledgeCoverageMatrix,
  researchQueueFromCoverage,
} from "@/lib/knowledge/knowledgeCoverage";
import type { KnowledgeRow } from "@/types/knowledge";

function row(partial: Partial<KnowledgeRow> & Pick<KnowledgeRow, "id" | "title">): KnowledgeRow {
  return {
    scope: "platform",
    status: "candidate",
    org_id: null,
    summary: null,
    body: null,
    content: {},
    attributes: {},
    source_kind: "filla_curated",
    trust_score: null,
    provenance: {},
    cohort_size: null,
    version: 1,
    supersedes_id: null,
    created_by: null,
    reviewed_by: null,
    published_at: null,
    applicability: { jurisdictions: ["France"], regions: [], languages: [], audiences: [] },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

describe("knowledgeCoverage", () => {
  it("marks verified cells covered and missing counterparts in the queue", () => {
    const rows = [
      row({
        id: "1",
        title: "Smoke alarms",
        status: "published",
        applicability: { jurisdictions: ["France"], regions: [], languages: [], audiences: [] },
      }),
      row({
        id: "2",
        title: "Smoke alarms",
        status: "candidate",
        applicability: { jurisdictions: ["UK"], regions: [], languages: [], audiences: [] },
      }),
    ];
    const matrix = buildKnowledgeCoverageMatrix(rows);
    expect(matrix.cells.smoke_alarms.France.status).toBe("covered");
    expect(matrix.cells.smoke_alarms.UK.status).toBe("partial");
    const queue = researchQueueFromCoverage(matrix);
    expect(queue.some((q) => q.jurisdiction === "UK" && q.priority === "medium")).toBe(true);
  });
});
