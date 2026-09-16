import { describe, expect, it } from "vitest";
import { proposePilotCalendarWindows } from "@/lib/content/knowledgeEditorialCalendar";
import {
  buildSubjectPackages,
  deriveNextAction,
  draftBodyToReadableProse,
  filterCounts,
  formatCoverageLine,
  packagesForFilter,
  sanitizeImportantGaps,
  subjectKeyFromTitle,
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

describe("schedule semantics + planning", () => {
  it("clusters gutters and heating separately from chimney", () => {
    expect(subjectKeyFromTitle("Gutter clearing — autumn")).toBe("gutters-autumn-leaf-risk");
    expect(subjectKeyFromTitle("Boiler service")).toBe("before-heating-season");
    expect(subjectKeyFromTitle("Chimney sweeping — France")).toBe("chimney-flue-sweeping");
  });

  it("does not put planning-queued subjects in Needs attention", () => {
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
          title: "Boiler service — France",
          status: "verified",
          applicability: { jurisdictions: ["France"], regions: [], languages: [], audiences: [] },
        }),
      ],
      topics: [],
      now: new Date("2026-09-15T12:00:00Z"),
    });
    expect(filterCounts(packages).attention).toBe(0);
    expect(packages.every((p) => p.actionLabel === null || p.filter !== "attention")).toBe(true);
    expect(packages.some((p) => p.machineState === "planning_queued")).toBe(true);
  });

  it("keeps Accept plan when drafts exist but plan is not accepted", () => {
    const next = deriveNextAction({
      planAccepted: false,
      planReady: true,
      hasBlockingGap: false,
      validPendingDrafts: false,
      allOutputsApproved: false,
      distributionReady: false,
      deferred: false,
    });
    expect(next.actionLabel).toBe("Accept plan");
    expect(next.needsAttention).toBe(true);
  });

  it("uses Review drafts only after plan accepted with valid drafts", () => {
    expect(
      deriveNextAction({
        planAccepted: true,
        planReady: false,
        hasBlockingGap: false,
        validPendingDrafts: true,
        allOutputsApproved: false,
        distributionReady: false,
        deferred: false,
      }).actionLabel
    ).toBe("Review drafts");
  });

  it("puts proposed plan packages into Scheduled calendar membership", () => {
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
      publishing: {
        schedule: {
          schedule_state: "proposed",
          window_label: "Week of 15 September",
          window_start: "2026-09-14",
        },
      },
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
      outputsByTopicId: {
        t1: [
          {
            id: "o1",
            topic_id: "t1",
            output_kind: "core_article",
            status: "needs_review",
            title: "Article",
            body: "## Hello\n\n**Bold** claim",
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

    const chimney = packages[0];
    expect(chimney.actionLabel).toBe("Accept plan");
    expect(chimney.scheduleState).toBe("proposed");
    expect(packagesForFilter(packages, "scheduled").some((p) => p.id === chimney.id)).toBe(true);
    expect(chimney.coverageSummary).toMatch(/France sourced/i);
    expect(chimney.coverageSummary).toMatch(/International incomplete/i);
    expect(chimney.deliverables.some((d) => d.label === "International article" && d.state === "Blocked")).toBe(
      true
    );
  });

  it("proposes a restrained weekly pilot calendar", () => {
    const cal = proposePilotCalendarWindows({
      now: new Date("2026-09-15T12:00:00Z"),
      subjectKeys: [
        "chimney-flue-sweeping",
        "before-heating-season",
        "smoke-carbon-monoxide-alarms",
        "gutters-autumn-leaf-risk",
        "party-walls",
      ],
      heatingSeason: true,
    });
    expect(cal[0].subjectKey).toBe("chimney-flue-sweeping");
    expect(cal.map((c) => c.subjectKey)).toContain("before-heating-season");
    expect(new Set(cal.map((c) => c.window_start)).size).toBe(cal.length);
  });

  it("sanitizes French gap noise and renders readable prose", () => {
    expect(
      sanitizeImportantGaps([
        "Besoin de vérifier le ramonage annuel",
        "France source does not cover insurance requirements",
      ])
    ).toEqual(["France source does not cover insurance requirements"]);
    expect(draftBodyToReadableProse("## Title\n\n**Bold** and *italic*")).toContain("Bold");
    expect(draftBodyToReadableProse("## Title\n\n**Bold**")).not.toContain("**");
  });

  it("formats coverage without enums", () => {
    expect(
      formatCoverageLine([
        { id: "international", label: "International", status: "Incomplete" },
        { id: "1", label: "France", status: "Sourced" },
      ])
    ).toBe("International incomplete · France sourced");
  });
});
