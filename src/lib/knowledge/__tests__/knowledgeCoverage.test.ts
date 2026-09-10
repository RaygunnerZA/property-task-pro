import { describe, expect, it } from "vitest";
import {
  buildKnowledgeCoverageMatrix,
  clusterResearchQueue,
  coverageGapId,
  distinctCoverageJurisdictions,
  MAX_RESEARCH_GAPS,
  normalizeCoverageJurisdiction,
  researchableIdsForJurisdiction,
  researchableIdsForTopic,
  researchGapIdsFromClusters,
  researchGapsFromIds,
  researchQueueFromCoverage,
} from "@/lib/knowledge/knowledgeCoverage";
import type { KnowledgeRow } from "@/types/knowledge";
import { MAX_RESEARCH_GAPS as SHARED_MAX } from "../../../../supabase/functions/_shared/knowledgeGapResearch.ts";

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
    expect(matrix.cells.smoke_alarms["United Kingdom"].status).toBe("partial");
    const queue = researchQueueFromCoverage(matrix);
    expect(queue.some((q) => q.jurisdiction === "United Kingdom" && q.priority === "medium")).toBe(
      true
    );
  });

  it("selects only missing and partial cells for a topic or jurisdiction", () => {
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
    expect(researchableIdsForTopic(matrix, "smoke_alarms", ["France", "United Kingdom"])).toEqual([
      coverageGapId("smoke_alarms", "United Kingdom"),
    ]);
    expect(researchableIdsForJurisdiction(matrix, "United Kingdom", matrix.topics)).toEqual([
      coverageGapId("smoke_alarms", "United Kingdom"),
    ]);
    const selected = researchGapsFromIds(matrix, [coverageGapId("smoke_alarms", "United Kingdom")]);
    expect(selected).toEqual([
      {
        id: "smoke_alarms::United Kingdom",
        topic_key: "smoke_alarms",
        topic: "Smoke alarms",
        jurisdiction: "United Kingdom",
        status: "partial",
      },
    ]);
  });

  it("keeps the client research batch cap aligned with the Edge Function", () => {
    expect(MAX_RESEARCH_GAPS).toBe(SHARED_MAX);
  });

  it("normalises overlapping UK labels without collapsing nations", () => {
    expect(normalizeCoverageJurisdiction("UK")).toBe("United Kingdom");
    expect(normalizeCoverageJurisdiction("GB")).toBe("United Kingdom");
    expect(normalizeCoverageJurisdiction("GB-ENG")).toBe("England");
    expect(normalizeCoverageJurisdiction("Great Britain")).toBe("Great Britain");
    const matrix = buildKnowledgeCoverageMatrix([
      row({
        id: "1",
        title: "Smoke alarms",
        status: "published",
        applicability: { jurisdictions: ["UK"], regions: [], languages: [], audiences: [] },
      }),
      row({
        id: "2",
        title: "Smoke alarms",
        status: "candidate",
        applicability: {
          jurisdictions: ["United Kingdom"],
          regions: [],
          languages: [],
          audiences: [],
        },
      }),
      row({
        id: "3",
        title: "Smoke alarms",
        status: "candidate",
        applicability: { jurisdictions: ["England"], regions: [], languages: [], audiences: [] },
      }),
    ]);
    expect(matrix.jurisdictions).toEqual(["England", "United Kingdom"]);
    expect(distinctCoverageJurisdictions(matrix.jurisdictions)).toEqual(["England"]);
    expect(matrix.cells.smoke_alarms.England.status).toBe("partial");
    expect(matrix.cells.smoke_alarms["United Kingdom"].status).toBe("covered");
  });

  it("clusters the research queue by topic and drops parent UK labels", () => {
    const rows = [
      row({
        id: "1",
        title: "Air conditioning / records",
        status: "published",
        applicability: { jurisdictions: ["France"], regions: [], languages: [], audiences: [] },
      }),
      row({
        id: "2",
        title: "Air conditioning / records",
        status: "candidate",
        applicability: { jurisdictions: ["England"], regions: [], languages: [], audiences: [] },
      }),
    ];
    const extraJurisdictions = [
      "England and Wales",
      "Northern Ireland",
      "Scotland",
      "United Kingdom",
      "Wales",
    ];
    for (const [index, jurisdiction] of extraJurisdictions.entries()) {
      rows.push(
        row({
          id: `other-${index}`,
          title: "Something else",
          status: "published",
          applicability: { jurisdictions: [jurisdiction], regions: [], languages: [], audiences: [] },
        })
      );
    }
    const matrix = buildKnowledgeCoverageMatrix(rows);
    expect(distinctCoverageJurisdictions(matrix.jurisdictions)).toEqual([
      "England",
      "France",
      "Northern Ireland",
      "Scotland",
      "Wales",
    ]);
    const items = researchQueueFromCoverage(matrix);
    expect(
      items
        .filter((item) => item.topic === "Air conditioning / records")
        .map((item) => item.jurisdiction)
        .sort()
    ).toEqual(["England", "Northern Ireland", "Scotland", "Wales"]);
    const clustered = clusterResearchQueue(items);
    const ac = clustered.find((c) => c.topic === "Air conditioning / records");
    expect(ac).toBeDefined();
    expect(ac!.items.map((item) => item.jurisdiction)).toEqual([
      "England",
      "Northern Ireland",
      "Scotland",
      "Wales",
    ]);
    expect(ac!.reason).toMatch(/4 jurisdictions/);
    expect(researchGapIdsFromClusters([ac!], MAX_RESEARCH_GAPS)).toEqual(
      ac!.items.map((item) => item.id)
    );
  });

  it("fills the research cap with whole topic clusters", () => {
    const clusters = [
      {
        topicKey: "a",
        topic: "A",
        priority: "high" as const,
        reason: "missing",
        items: [
          {
            id: "a::England",
            priority: "high" as const,
            topic: "A",
            jurisdiction: "England",
            reason: "missing",
            status: "missing" as const,
            knowledgeIds: [],
          },
          {
            id: "a::Wales",
            priority: "high" as const,
            topic: "A",
            jurisdiction: "Wales",
            reason: "missing",
            status: "missing" as const,
            knowledgeIds: [],
          },
        ],
      },
      {
        topicKey: "b",
        topic: "B",
        priority: "high" as const,
        reason: "missing",
        items: [
          {
            id: "b::France",
            priority: "high" as const,
            topic: "B",
            jurisdiction: "France",
            reason: "missing",
            status: "missing" as const,
            knowledgeIds: [],
          },
        ],
      },
    ];
    expect(researchGapIdsFromClusters(clusters, 2)).toEqual(["a::England", "a::Wales"]);
    expect(researchGapIdsFromClusters(clusters, 3)).toEqual([
      "a::England",
      "a::Wales",
      "b::France",
    ]);
  });
});
