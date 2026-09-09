import { describe, expect, it } from "vitest";
import type { KnowledgeRow } from "@/types/knowledge";
import {
  computeReviewToolbarCounts,
  displayCanonicalGuidance,
  displayJurisdiction,
  guidanceProvenanceChip,
  guidanceQualityLabel,
  hasCanonicalGuidance,
  isEligibleForGuidanceGeneration,
  isEligibleForGuidanceImprovement,
  matchesReviewQueue,
  chunkIds,
  primaryActionForRow,
  buildReviewTrustChecks,
  reviewBlockingChecks,
} from "@/lib/knowledge/knowledgeReviewState";

function row(overrides: Partial<KnowledgeRow> = {}): KnowledgeRow {
  return {
    id: "r1",
    scope: "platform",
    status: "candidate",
    org_id: null,
    title: "Consent or notice before work to protected trees",
    summary: null,
    body: null,
    content: {},
    attributes: {
      action: "Check TPO status before pruning",
      applies_when: "Before tree work",
      legal_status: "Mandatory when triggered",
      frequency: "Before work",
      local_variation: "Local planning authority lookup required",
    },
    source_kind: "filla_curated",
    trust_score: 0.4,
    provenance: {},
    cohort_size: null,
    version: 1,
    supersedes_id: null,
    created_by: null,
    reviewed_by: null,
    published_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    applicability: {
      jurisdictions: ["United Kingdom"],
      regions: [],
      languages: ["en"],
      audiences: ["manager"],
    },
    ...overrides,
  };
}

const gov = [
  {
    id: "s1",
    url: "https://www.gov.uk/guidance/tree-preservation-orders-and-trees-in-conservation-areas",
    label: "TPO guidance",
    source_type: "url",
    created_at: new Date().toISOString(),
    metadata: {},
  },
];

describe("knowledgeReviewState", () => {
  it("treats empty summary/body as missing canonical guidance even when action exists", () => {
    expect(hasCanonicalGuidance(row())).toBe(false);
    expect(displayCanonicalGuidance(row())).toBe("No guidance written yet.");
    expect(isEligibleForGuidanceGeneration(row(), gov)).toBe(true);
  });

  it("does not show All as jurisdiction", () => {
    expect(
      displayJurisdiction(
        row({
          applicability: {
            jurisdictions: ["All"],
            regions: [],
            languages: [],
            audiences: [],
          },
        })
      )
    ).toBe("Jurisdiction missing");
  });

  it("lists classification and critic among blockers for TPO-like rows", () => {
    const checks = buildReviewTrustChecks(
      row({
        summary:
          "Before pruning or felling a protected tree, check protection status and obtain any required consent or notice from the local planning authority.",
      }),
      {
        sources: gov,
      }
    );
    expect(reviewBlockingChecks(checks).some((b) => b.id === "applicability")).toBe(true); // UK nation
    expect(reviewBlockingChecks(checks).some((b) => b.id === "contradiction")).toBe(true);
    expect(reviewBlockingChecks(checks).some((b) => b.id === "human")).toBe(true);
    expect(reviewBlockingChecks(checks).some((b) => b.id === "classification")).toBe(false);
    // Short/incomplete guidance takes priority: Improve before Resolve
    expect(
      primaryActionForRow(
        row({
          summary:
            "Before pruning or felling a protected tree, check protection status and obtain any required consent or notice from the local planning authority.",
        }),
        checks,
        gov
      ).kind
    ).toBe("improve");
  });

  it("oil tank with short guidance prefers Improve even without source", () => {
    const oil = row({
      title: "Inspect tank, supports, bund, pipework, corrosion and leaks",
      summary:
        "When a heating-oil tank is present, inspect the tank, supports, bund and pipework for corrosion and leaks, and keep a simple record of checks.",
      attributes: {
        applies_when: "Heating-oil tank present",
        action: "Inspect tank",
        classification: "Preventative; pollution/building rules may apply",
        legal_status: "Preventative; pollution/building rules may apply",
        trigger_type: "event_driven",
      },
      applicability: {
        jurisdictions: ["United Kingdom"],
        regions: [],
        languages: ["en"],
        audiences: [],
      },
    });
    const checks = buildReviewTrustChecks(oil, { sources: [] });
    expect(reviewBlockingChecks(checks).some((b) => b.id === "source_authority")).toBe(
      true
    );
    expect(primaryActionForRow(oil, checks, []).label).toBe("Improve");
  });

  it("Scotland alarms retain Scotland and need Improve when guidance is short", () => {
    const alarms = row({
      title: "Interlinked smoke and heat alarms",
      summary:
        "In Scotland, every home must have interlinked smoke and heat alarms; install and maintain them, and replace units by the manufacturer date.",
      attributes: {
        legal_status: "Mandatory",
        applies_when: "Every home in Scotland",
        frequency: "Continuous; replace by manufacturer date",
        trigger_type: "continuous",
      },
      applicability: {
        jurisdictions: ["Scotland"],
        regions: [],
        languages: ["en"],
        audiences: ["owner"],
      },
    });
    expect(displayJurisdiction(alarms)).toBe("Scotland");
    const checks = buildReviewTrustChecks(alarms, { sources: gov });
    expect(reviewBlockingChecks(checks).some((b) => b.id === "guidance")).toBe(true);
    expect(primaryActionForRow(alarms, checks, gov).kind).toBe("improve");
  });

  it("pool never displays All as jurisdiction", () => {
    const pool = row({
      title: "PM-POOL-001",
      summary: "Test barrier/gate/alarm/cover and document",
      attributes: {
        classification: "Legal in some places",
        legal_status: "Legal in some places",
        applies_when: "Pool present",
        trigger_type: "event_driven",
      },
      applicability: {
        jurisdictions: [],
        regions: [],
        languages: [],
        audiences: [],
      },
    });
    expect(displayJurisdiction(pool)).toBe("Jurisdiction missing");
    const checks = buildReviewTrustChecks(pool, { sources: gov });
    expect(reviewBlockingChecks(checks).some((b) => b.id === "applicability")).toBe(true);
  });

  it("labels weak imported guidance as Needs work and Imported draft", () => {
    const weak = row({
      summary: "Maintain and remove hazards/waste",
      attributes: {
        action: "Maintain and remove hazards/waste",
        legal_status: "Mandatory",
        applies_when: "Ongoing",
        trigger_type: "continuous",
      },
      applicability: {
        jurisdictions: ["France"],
        regions: [],
        languages: ["fr"],
        audiences: [],
      },
      provenance: {
        guidance_draft: {
          source: "imported_action",
          unverified: true,
          proposed_at: "2026-08-25T08:00:00Z",
        },
      },
    });
    expect(guidanceQualityLabel(weak)).toBe("Needs work");
    expect(guidanceProvenanceChip(weak)).toBe("Imported draft");
    expect(isEligibleForGuidanceImprovement(weak, gov)).toBe(true);
    expect(primaryActionForRow(weak, buildReviewTrustChecks(weak, { sources: gov }), gov).kind).toBe(
      "improve"
    );
  });

  it("queues meaningful drafts awaiting critic separately from needs-work", () => {
    const draft = row({
      summary:
        "In Scotland, every home must have interlinked smoke and heat alarms; install and maintain them throughout the property, test them regularly, and replace each unit by the manufacturer date so the system stays compliant.",
      attributes: {
        legal_status: "Mandatory",
        applies_when: "Every home in Scotland",
        frequency: "Continuous; replace by manufacturer date",
        trigger_type: "continuous",
      },
      applicability: {
        jurisdictions: ["Scotland"],
        regions: [],
        languages: ["en"],
        audiences: ["owner"],
      },
    });
    const checks = buildReviewTrustChecks(draft, { sources: gov });
    expect(matchesReviewQueue("awaiting_critic", draft, checks, gov)).toBe(true);
    expect(matchesReviewQueue("needs_work", draft, checks, gov)).toBe(false);
    expect(matchesReviewQueue("all", draft, checks, gov)).toBe(true);
    const counts = computeReviewToolbarCounts([draft], new Map([["r1", gov]]));
    expect(counts.awaitingCritic).toBe(1);
    expect(counts.needsWork).toBe(0);
    expect(counts.all).toBe(1);
  });

  it("chunks guidance ids for batched AI invokes", () => {
    expect(chunkIds(["a", "b", "c", "d", "e"], 2)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });
});
