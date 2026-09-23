import { describe, expect, it } from "vitest";
import {
  buildRegionalCoverage,
  dedupeImportantGaps,
  deliverableNavTarget,
  draftDriftedFromSubject,
  eligibleTextApprovedForImages,
  expandJurisdictionLabels,
  imageStateFromGates,
  internationalSupportedFromCoverage,
  isPlaceholderOutput,
  jurisdictionsFromGapText,
  knowledgeIdForReviewDecision,
  nextAutomaticCopy,
  nextDecisionCopy,
  pickPrimaryKnowledgeId,
  coverageNavTarget,
} from "@/lib/content/knowledgePackagePilot";
import {
  buildSubjectPackages,
  formatCoverageLine,
  sanitizeImportantGaps,
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

describe("knowledgePackagePilot", () => {
  it("expands UK without inventing duplicate children when already present", () => {
    expect(expandJurisdictionLabels("UK")).toEqual(["England", "Scotland", "Wales"]);
    const regional = buildRegionalCoverage([
      knowledge({
        id: "uk1",
        title: "Gas safety — UK",
        status: "candidate",
        applicability: { jurisdictions: ["United Kingdom"] },
      }),
      knowledge({
        id: "eng1",
        title: "HSE gas — England",
        status: "candidate",
        applicability: { jurisdictions: ["England"] },
      }),
      knowledge({
        id: "sct1",
        title: "Repairing Standard — Scotland",
        status: "candidate",
        applicability: { jurisdictions: ["Scotland"] },
      }),
    ]);
    expect(regional.some((c) => /united kingdom|^uk$/i.test(c.label))).toBe(false);
    expect(regional.map((c) => c.label).sort()).toEqual(["England", "Scotland", "Wales"]);
    expect(regional.find((c) => c.label === "England")?.knowledgeId).toBe("eng1");
  });

  it("opens Review England on the England-specific row, not a UK-wide sibling", () => {
    const rows = [
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
    ];
    const coverage = buildRegionalCoverage(rows, { subjectKey: "before-heating-season" });
    expect(coverage.find((c) => c.label === "England")?.knowledgeId).toBe("gas");
    expect(
      knowledgeIdForReviewDecision({
        coverage,
        decisionRegion: "England",
        decisionKnowledgeIds: ["epc", "gas"],
        rows,
        subjectKey: "before-heating-season",
      })
    ).toBe("gas");
  });

  it("detects certificate-filing drafts as drifted from heating-season subject", () => {
    expect(
      draftDriftedFromSubject("before-heating-season", {
        title: "How to Organize Heating Certificates & Service Records for Timely Renewals",
        body: "File current heating and safety certificates in your property record store.",
        output_kind: "core_article",
      })
    ).toBe(true);
    expect(
      draftDriftedFromSubject("before-heating-season", {
        title: "Before the heating season — prepare boilers and flues",
        body: "Service heating plant before cold weather; check flues and carbon monoxide alarms.",
        output_kind: "core_article",
      })
    ).toBe(false);
  });

  it("keeps image gates consistent", () => {
    expect(
      imageStateFromGates({ hasImage: false, planAccepted: false, eligibleTextApproved: false }).state
    ).toBe("Waiting");
    expect(
      imageStateFromGates({ hasImage: false, planAccepted: true, eligibleTextApproved: false }).hint
    ).toMatch(/approved eligible text drafts/i);
    expect(
      imageStateFromGates({ hasImage: false, planAccepted: true, eligibleTextApproved: true }).state
    ).toBe("Ready to upload");
  });

  it("does not unlock images from drifted certificate drafts alone", () => {
    expect(
      eligibleTextApprovedForImages({
        planAccepted: true,
        intlOk: true,
        subjectKey: "before-heating-season",
        outputs: [
          {
            title: "How to Organize Heating Certificates",
            body: "File heating certificates for renewals.",
            output_kind: "core_article",
            status: "approved",
          },
        ],
      })
    ).toBe(false);
    expect(
      eligibleTextApprovedForImages({
        planAccepted: true,
        intlOk: true,
        subjectKey: "before-heating-season",
        outputs: [
          {
            title: "Before the heating season — prepare boilers",
            body: "Service heating plant before cold weather.",
            output_kind: "core_article",
            status: "approved",
          },
        ],
      })
    ).toBe(true);
  });

  it("maps coverage and deliverable navigation targets", () => {
    expect(
      coverageNavTarget({
        id: "fr",
        label: "France",
        status: "Needs a decision",
        knowledgeId: "k-fr",
      })
    ).toEqual({ kind: "knowledge", knowledgeId: "k-fr" });
    expect(
      coverageNavTarget({
        id: "gap-england",
        label: "England",
        status: "Being researched",
      }).kind
    ).toBe("research");
    expect(
      coverageNavTarget({
        id: "international",
        label: "International",
        status: "Incomplete",
      }).kind
    ).toBe("none");
    expect(
      deliverableNavTarget({
        id: "international-article",
        state: "Blocked",
        outputId: "o1",
      })
    ).toEqual({ kind: "output", outputId: "o1" });
    expect(
      deliverableNavTarget({
        id: "images",
        state: "Waiting",
        blockedReason: "Waiting on Accept plan",
      }).kind
    ).toBe("none");
    expect(jurisdictionsFromGapText("England/Scotland official guidance")).toEqual([
      "England",
      "Scotland",
    ]);
  });

  it("dedupes identical gaps", () => {
    expect(
      dedupeImportantGaps([
        "England/Scotland official guidance",
        "England/Scotland official guidance",
        " France chaudière ",
      ])
    ).toEqual(["England/Scotland official guidance", "France chaudière"]);
  });

  it("prefers seasonal Knowledge over certificate-filing as primary", () => {
    const id = pickPrimaryKnowledgeId(
      "before-heating-season",
      [
        knowledge({
          id: "cert",
          title: "Keep heating certificates and service records filed",
          status: "published",
        }),
        knowledge({
          id: "season",
          title: "Service heating systems before the heating season",
          status: "published",
        }),
      ],
      "cert"
    );
    expect(id).toBe("season");
  });
});

describe("before-heating-season package eligibility", () => {
  it("blocks international article while coverage is incomplete even if a draft exists", () => {
    const topic = {
      id: "t-heat",
      knowledge_id: "k-season",
      title: "Before the heating season",
      status: "active",
      workflow_status: "content_review",
      content_scope: "international_overview",
      strategy: {
        approval_status: "approved",
        content_scope: "international_overview",
        primary_form: "informational_article",
        derivative_forms: ["social_post"],
        supporting_content: [],
        exclusions: [],
        source_gaps: [],
        objective: "Seasonal preparation overview",
      },
      seo: {},
      brief: {},
      creative: {},
      publishing: {},
      knowledge_version: 1,
      applicability_snapshot: {},
      upstream_hash: null,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-20T00:00:00Z",
    } as ContentTopicRow;

    const packages = buildSubjectPackages({
      knowledge: [
        knowledge({
          id: "k-season",
          title: "Service heating systems before the heating season",
          status: "published",
          applicability: { unscoped: true },
        }),
        knowledge({
          id: "k-fr",
          title: "Entretien chaudière — France",
          status: "candidate",
          applicability: { jurisdictions: ["France"] },
        }),
      ],
      topics: [topic],
      outputsByTopicId: {
        "t-heat": [
          {
            id: "o1",
            topic_id: "t-heat",
            output_kind: "core_article",
            status: "draft",
            title: "How to Organize Heating Certificates & Service Records for Timely Renewals",
            body: "File current heating certificates for renewals.",
            structured: {},
            provenance: {},
            version: 1,
            approved_by: null,
            approved_at: null,
            created_at: "2026-09-20T00:00:00Z",
            updated_at: "2026-09-20T00:00:00Z",
          },
        ],
      },
      now: new Date("2026-09-20T12:00:00Z"),
    });

    const pkg = packages.find((p) => p.subjectKey === "before-heating-season");
    expect(pkg).toBeTruthy();
    expect(pkg!.coverageSummary).toMatch(/France candidate found/i);
    expect(pkg!.coverage.some((c) => c.label === "France" && c.status === "Needs a decision")).toBe(
      true
    );
    const article = pkg!.deliverables.find((d) => d.id === "international-article");
    expect(article?.state).toBe("Blocked");
    expect(article?.stale).toBe(true);
    expect(pkg!.primaryKind).toBe("resolve_gap");
    expect(pkg!.actionLabel).toBe("Review France");
    expect(pkg!.filter).toBe("attention");
    expect(pkg!.decisionKnowledgeIds).toContain("k-fr");
    expect(formatCoverageLine(pkg!.coverage)).toMatch(/France candidate found/);
    expect(sanitizeImportantGaps(["Same gap", "Same gap", "Other gap"])).toEqual([
      "Same gap",
      "Other gap",
    ]);
    expect(internationalSupportedFromCoverage(pkg!.coverage)).toBe(false);
  });
});

describe("reviewer copy helpers", () => {
  it("names the remaining machine work", () => {
    expect(
      nextAutomaticCopy({
        missingRegions: ["England", "Switzerland"],
        comparisonReady: false,
        planAccepted: false,
      })
    ).toBe(
      "Filla will research England and Switzerland, build the comparison, and propose the article plan."
    );
    expect(
      nextDecisionCopy({
        primaryKind: "resolve_gap",
        missingRegions: [],
        decisionKnowledgeIds: ["a", "b"],
        decisionRegions: ["England", "France"],
        staleDraftCount: 0,
      }).title
    ).toBe("Review candidates");
  });

  it("hides empty needs_update and international in-app tips", () => {
    expect(
      isPlaceholderOutput(
        { title: "", body: "", status: "needs_update", output_kind: "core_article" },
        "international_overview"
      )
    ).toBe(true);
    expect(
      isPlaceholderOutput(
        { title: "Tip", body: "Keep detectors working.", status: "draft", output_kind: "in_app_tip" },
        "international_overview"
      )
    ).toBe(true);
    expect(
      isPlaceholderOutput(
        { title: "France guide", body: "Install detectors.", status: "draft", output_kind: "core_article" },
        "international_overview"
      )
    ).toBe(false);
  });
});
