import { describe, expect, it } from "vitest";
import {
  buildSubjectPackages,
  filterCounts,
  formatCoverageLine,
  subjectKeyFromTitle,
  subjectDisplayTitle,
} from "@/lib/content/knowledgeSubjectPackage";
import type { ContentTopicRow, KnowledgeRow } from "@/types/knowledge";

function knowledge(
  partial: Partial<KnowledgeRow> & Pick<KnowledgeRow, "id" | "title" | "status">
): KnowledgeRow {
  return {
    scope: "platform",
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
    applicability: {},
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-15T00:00:00Z",
    ...partial,
  } as KnowledgeRow;
}

describe("knowledgeSubjectPackage triage", () => {
  it("clusters heating prep separately from chimney", () => {
    expect(subjectKeyFromTitle("Boiler service — France")).toBe("before-heating-season");
    expect(subjectKeyFromTitle("Exposed pipework")).toBe("before-heating-season");
    expect(subjectKeyFromTitle("Chimney sweeping — France")).toBe("chimney-flue-sweeping");
    expect(subjectDisplayTitle("before-heating-season", "x")).toBe("Before the heating season");
  });

  it("does not put unplanned Knowledge in Needs attention", () => {
    const packages = buildSubjectPackages({
      knowledge: [
        knowledge({
          id: "k1",
          title: "Party walls — France",
          status: "verified",
          applicability: { jurisdictions: ["France"], regions: [], languages: [], audiences: [] },
        }),
        knowledge({
          id: "k2",
          title: "Private sewage — France",
          status: "verified",
          applicability: { jurisdictions: ["France"], regions: [], languages: [], audiences: [] },
        }),
        knowledge({
          id: "k3",
          title: "Boiler service — France",
          status: "verified",
          applicability: { jurisdictions: ["France"], regions: [], languages: [], audiences: [] },
        }),
      ],
      topics: [],
      now: new Date("2026-09-15T12:00:00Z"),
    });
    const counts = filterCounts(packages);
    expect(counts.attention).toBe(0);
    expect(counts.monitoring).toBeGreaterThan(0);
    const heating = packages.find((p) => p.subjectKey === "before-heating-season");
    expect(heating?.filter).toBe("monitoring");
    expect(heating?.machineState).toBe("planning_queued");
    expect(heating?.actionLabel).toBeNull();
    expect(heating?.deliverablesSummary).toBe("Assessing opportunity");
    expect(heating?.autoPlanEligible).toBe(true);
  });

  it("puts chimney with ready plan in Needs attention as Accept plan", () => {
    const topic = {
      id: "t1",
      knowledge_id: "k1",
      title: "Chimney and flue sweeping",
      status: "active",
      workflow_status: "plan_review",
      content_scope: "international_overview",
      strategy: {
        approval_status: "pending",
        content_scope: "international_overview",
        primary_form: "informational_article",
        derivative_forms: ["social_carousel", "social_post"],
        supporting_content: [
          { label: "France country guide", kind: "country_guide", jurisdiction: "France" },
        ],
        exclusions: [],
        source_gaps: [],
      },
      seo: {},
      brief: {},
      creative: {},
      publishing: {},
      knowledge_version: 1,
      applicability_snapshot: {},
      upstream_hash: null,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-15T00:00:00Z",
    } as ContentTopicRow;

    const packages = buildSubjectPackages({
      knowledge: [
        knowledge({
          id: "k1",
          title: "Chimney sweeping — France",
          status: "verified",
          applicability: { jurisdictions: ["France"], regions: [], languages: [], audiences: [] },
        }),
      ],
      topics: [topic],
      now: new Date("2026-09-15T12:00:00Z"),
    });
    expect(packages[0].filter).toBe("attention");
    expect(packages[0].actionLabel).toBe("Accept plan");
    expect(packages[0].whyNow).toMatch(/heating/i);
    expect(packages[0].coverageSummary).toMatch(/France sourced/i);
    expect(filterCounts(packages).attention).toBe(1);
  });

  it("shows Review drafts when outputs await judgement", () => {
    const topic = {
      id: "t1",
      knowledge_id: "k1",
      title: "Chimney and flue sweeping",
      status: "active",
      workflow_status: "content_review",
      content_scope: "international_overview",
      strategy: {
        approval_status: "approved",
        content_scope: "international_overview",
        primary_form: "informational_article",
        derivative_forms: ["social_post"],
        supporting_content: [{ label: "France country guide", jurisdiction: "France" }],
        exclusions: [],
        source_gaps: [],
      },
      seo: {},
      brief: {},
      creative: {},
      publishing: {},
      knowledge_version: 1,
      applicability_snapshot: {},
      upstream_hash: null,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-15T00:00:00Z",
    } as ContentTopicRow;

    const packages = buildSubjectPackages({
      knowledge: [
        knowledge({
          id: "k1",
          title: "Chimney sweeping — France",
          status: "published",
          applicability: { jurisdictions: ["France"], regions: [], languages: [], audiences: [] },
        }),
      ],
      topics: [topic],
      outputsByTopicId: {
        t1: [
          {
            id: "o1",
            topic_id: "t1",
            output_kind: "core_article",
            status: "needs_review",
            title: "Article",
            body: "…",
            structured: {},
            provenance: {},
            version: 1,
            approved_by: null,
            approved_at: null,
            created_at: "2026-09-15T00:00:00Z",
            updated_at: "2026-09-15T00:00:00Z",
          },
        ],
      },
      now: new Date("2026-09-15T12:00:00Z"),
    });
    expect(packages[0].actionLabel).toBe("Review drafts");
    expect(packages[0].filter).toBe("attention");
    expect(packages[0].outcome).toMatch(/International article|Drafts ready/i);
  });

  it("formats coverage without enums", () => {
    expect(
      formatCoverageLine([
        { id: "international", label: "International", status: "Ready" },
        { id: "1", label: "France", status: "Sourced" },
        { id: "2", label: "Scotland", status: "Sourced" },
      ])
    ).toBe("International ready · France sourced · Scotland sourced");
  });
});
