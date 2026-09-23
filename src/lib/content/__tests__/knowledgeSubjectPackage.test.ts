import { describe, expect, it } from "vitest";
import { proposePilotCalendarWindows } from "@/lib/content/knowledgeEditorialCalendar";
import {
  buildSubjectPackages,
  coverageProgressHint,
  deliverableProgressHint,
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
    expect(subjectKeyFromTitle("Landlord gas-appliance and flue maintenance — England")).toBe(
      "landlord-gas-maintenance"
    );
    expect(subjectKeyFromTitle("Valid Energy Performance Certificate before marketing")).not.toBe(
      "before-heating-season"
    );
  });

  it("does not fold an EPC sales certificate into the heating-season package", () => {
    const packages = buildSubjectPackages({
      knowledge: [
        knowledge({
          id: "epc",
          title: "Valid Energy Performance Certificate before marketing",
          status: "candidate",
          applicability: { jurisdictions: ["United Kingdom"] },
        }),
        knowledge({
          id: "gas",
          title: "Before the heating season — England",
          status: "candidate",
          applicability: { jurisdictions: ["England"] },
        }),
      ],
      topics: [],
      now: new Date("2026-09-21T12:00:00Z"),
    });
    const heating = packages.find((p) => p.subjectKey === "before-heating-season");
    expect(heating?.knowledgeRows.map((r) => r.id)).toEqual(["gas"]);
    expect(heating?.coverage.find((c) => c.label === "England")?.knowledgeId).toBe("gas");
    expect(
      packages.find((p) => p.knowledgeRows.some((r) => r.id === "epc"))?.subjectKey
    ).not.toBe("before-heating-season");
  });

  it("reviews England landlord-gas on Before the heating season in the heating window", () => {
    const packages = buildSubjectPackages({
      knowledge: [
        knowledge({
          id: "fr",
          title: "Entretien annuel de la chaudière",
          status: "candidate",
          applicability: { jurisdictions: ["France"] },
        }),
        knowledge({
          id: "gas",
          title: "Landlord gas-appliance and flue maintenance — England",
          status: "candidate",
          applicability: { jurisdictions: ["England"] },
        }),
      ],
      topics: [],
      now: new Date("2026-09-21T12:00:00Z"),
    });
    const heating = packages.find((p) => p.subjectKey === "before-heating-season");
    expect(packages.some((p) => p.subjectKey === "landlord-gas-maintenance")).toBe(false);
    expect(heating?.knowledgeRows.map((r) => r.id).sort()).toEqual(["fr", "gas"]);
    expect(heating?.coverage.find((c) => c.label === "England")?.knowledgeId).toBe("gas");
    expect(heating?.coverageSummary).toMatch(/England candidate found/);
    expect(heating?.coverageSummary).toMatch(/France candidate found/);
    expect(heating?.coverageSummary).not.toMatch(/researching/i);
    expect(heating?.actionLabel).toBe("Review candidates");
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
    expect(chimney.coverageSummary).toMatch(/France covered/i);
    expect(chimney.coverageSummary).not.toMatch(/researching/i);
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
    ).toBe("France covered");
    expect(
      formatCoverageLine([
        { id: "international", label: "International", status: "Incomplete" },
        { id: "fr", label: "France", status: "Sourced" },
        { id: "sct", label: "Scotland", status: "Needs a decision" },
        { id: "eng", label: "England", status: "Being researched" },
        { id: "ch", label: "Switzerland", status: "Being researched" },
      ])
    ).toBe("France covered · Scotland candidate found");
  });

  it("explains Being researched and Waiting without false ETAs", () => {
    expect(coverageProgressHint("Being researched")).toMatch(/No clock/i);
    expect(coverageProgressHint("Being researched")).toMatch(/allowlisted/i);
    expect(deliverableProgressHint("Waiting")).toMatch(/Nothing is running/i);
    expect(deliverableProgressHint("Ready to upload")).toMatch(/Your turn/i);
  });

  it("unlocks Images ready to upload after France drafts are approved", () => {
    const topic = {
      id: "t-chimney",
      knowledge_id: "k-fr",
      title: "Chimney and flue sweeping",
      status: "active",
      workflow_status: "content_review",
      content_scope: "international_overview",
      strategy: {
        approval_status: "approved",
        content_scope: "international_overview",
        primary_form: "informational_article",
        derivative_forms: ["social_carousel"],
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
          id: "k-fr",
          title: "Chimney sweeping — France",
          status: "published",
          applicability: { jurisdictions: ["France"], regions: [], languages: [], audiences: [] },
        }),
      ],
      topics: [topic],
      outputsByTopicId: {
        "t-chimney": [
          {
            id: "o-guide",
            topic_id: "t-chimney",
            output_kind: "core_article",
            status: "approved",
            title: "France guide",
            body: "Guide body",
            structured: {},
            provenance: {},
            version: 1,
            approved_by: null,
            approved_at: "2026-09-20T00:00:00Z",
            created_at: "2026-09-15T00:00:00Z",
            updated_at: "2026-09-20T00:00:00Z",
          },
          {
            id: "o-social",
            topic_id: "t-chimney",
            output_kind: "social_post",
            status: "approved",
            title: "Social",
            body: "Post",
            structured: {},
            provenance: {},
            version: 1,
            approved_by: null,
            approved_at: "2026-09-20T00:00:00Z",
            created_at: "2026-09-15T00:00:00Z",
            updated_at: "2026-09-20T00:00:00Z",
          },
        ],
      },
      now: new Date("2026-09-20T12:00:00Z"),
    });

    const chimney = packages.find((p) => p.subjectKey === "chimney-flue-sweeping");
    expect(chimney).toBeTruthy();
    expect(chimney!.deliverables.find((d) => d.id === "images")?.state).toBe("Ready to upload");
    expect(chimney!.actionLabel).toBe("Approve distribution");
  });

  it("puts a Scotland smoke/CO candidate in Needs attention with Review Scotland", () => {
    const topic = {
      id: "t-smoke",
      knowledge_id: "k-fr",
      title: "Smoke and carbon monoxide alarms",
      status: "active",
      workflow_status: "seo_review",
      content_scope: "international_overview",
      strategy: {
        approval_status: "none",
        content_scope: "international_overview",
        primary_form: "informational_article",
        derivative_forms: ["faq", "in_app_tip"],
        supporting_content: [],
        exclusions: [],
        source_gaps: [],
        objective: "",
      },
      seo: {},
      brief: {},
      creative: {},
      publishing: {},
      knowledge_version: 1,
      applicability_snapshot: {},
      upstream_hash: null,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-21T00:00:00Z",
    } as ContentTopicRow;

    const packages = buildSubjectPackages({
      knowledge: [
        knowledge({
          id: "k-fr",
          title: "Smoke and carbon monoxide alarms — France",
          status: "published",
          applicability: { jurisdictions: ["France"], regions: [], languages: [], audiences: [] },
        }),
        knowledge({
          id: "k-sct",
          title: "Fire and smoke alarms — Scotland",
          status: "candidate",
          applicability: { jurisdictions: ["Scotland"], regions: [], languages: [], audiences: [] },
        }),
      ],
      topics: [topic],
      outputsByTopicId: {
        "t-smoke": [
          {
            id: "o-article",
            topic_id: "t-smoke",
            output_kind: "core_article",
            status: "needs_update",
            title: "",
            body: "",
            structured: {},
            provenance: {},
            version: 1,
            approved_by: null,
            approved_at: null,
            created_at: "2026-09-21T00:00:00Z",
            updated_at: "2026-09-21T00:00:00Z",
          },
          {
            id: "o-faq",
            topic_id: "t-smoke",
            output_kind: "faq",
            status: "needs_update",
            title: "",
            body: "",
            structured: {},
            provenance: {},
            version: 1,
            approved_by: null,
            approved_at: null,
            created_at: "2026-09-21T00:00:00Z",
            updated_at: "2026-09-21T00:00:00Z",
          },
          {
            id: "o-tip",
            topic_id: "t-smoke",
            output_kind: "in_app_tip",
            status: "needs_update",
            title: "",
            body: "",
            structured: {},
            provenance: {},
            version: 1,
            approved_by: null,
            approved_at: null,
            created_at: "2026-09-21T00:00:00Z",
            updated_at: "2026-09-21T00:00:00Z",
          },
        ],
      },
      now: new Date("2026-09-21T12:00:00Z"),
    });

    const pkg = packages.find((p) => p.subjectKey === "smoke-carbon-monoxide-alarms");
    expect(pkg).toBeTruthy();
    expect(pkg!.filter).toBe("attention");
    expect(pkg!.primaryKind).toBe("resolve_gap");
    expect(pkg!.actionLabel).toBe("Review Scotland");
    expect(pkg!.nextDecisionReason).toMatch(/Scotland/i);
    expect(pkg!.coverageSummary).toBe("France covered · Scotland candidate found");
    expect(pkg!.deliverablesSummary).not.toMatch(/assessing opportunity/i);
    expect(pkg!.deliverables.some((d) => d.id === "in_app_tip")).toBe(false);
    expect(pkg!.deliverables.some((d) => d.state === "Planned")).toBe(false);
    expect(pkg!.reasonChips).not.toContain("Knowledge gap");
  });
});
