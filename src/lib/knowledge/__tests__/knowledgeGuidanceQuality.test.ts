import { describe, expect, it } from "vitest";
import {
  assessGuidanceQuality,
  formatCriticField,
  isMeaningfulGuidanceProse,
  needsGuidanceImprovement,
} from "@/lib/knowledge/knowledgeGuidanceQuality";
import type { KnowledgeRow } from "@/types/knowledge";
import {
  buildTrustChecks,
  canVerify,
  parseCriticSummary,
} from "@/lib/knowledge/knowledgePresentation";
import {
  computeReviewToolbarCounts,
  hasCanonicalGuidance,
  primaryActionForRow,
  buildReviewTrustChecks,
} from "@/lib/knowledge/knowledgeReviewState";

function row(overrides: Partial<KnowledgeRow> = {}): KnowledgeRow {
  return {
    id: "r1",
    scope: "platform",
    status: "candidate",
    org_id: null,
    title: "Notify material risk changes",
    summary: null,
    body: null,
    content: {},
    attributes: {
      action: "Review policy and notify insurer as required",
      applies_when: "Material circumstances change",
      legal_status: "Contractual / insurance",
      frequency: "When triggered",
      evidence: "Policy notification record",
      risk_or_consequence: "Cover may be affected",
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
      jurisdictions: ["England"],
      regions: [],
      languages: ["en"],
      audiences: ["owner"],
    },
    ...overrides,
  };
}

const gov = [
  {
    id: "s1",
    url: "https://www.gov.uk/guidance/insurance",
    label: "Insurance guidance",
    source_type: "url",
    created_at: new Date().toISOString(),
    metadata: {},
  },
];

const MEANINGFUL =
  "Review your home-insurance policy and notify the insurer when material circumstances change, including significant works, extended vacancy, a change of use or occupancy, or the addition of higher-risk features. Follow the notification requirements and deadlines stated in the policy.";

describe("guidance quality", () => {
  it("marks empty as Missing", () => {
    expect(assessGuidanceQuality(row()).state).toBe("missing");
  });

  it("flags circular imported fragments as Needs improvement", () => {
    const q = assessGuidanceQuality(
      row({ summary: "Review policy and notify insurer as required" })
    );
    expect(q.state).toBe("needs_improvement");
    expect(needsGuidanceImprovement(row({ summary: q.text }))).toBe(true);
  });

  it("fails IDs, URLs, numbers and title-only guidance", () => {
    expect(assessGuidanceQuality(row({ summary: "1087" })).state).toBe(
      "needs_improvement"
    );
    expect(
      assessGuidanceQuality(row({ summary: "https://www.gov.uk/x" })).state
    ).toBe("needs_improvement");
    expect(
      assessGuidanceQuality(row({ summary: "PM-UK-INS-001" })).state
    ).toBe("needs_improvement");
    expect(
      assessGuidanceQuality(
        row({
          title: "Notify material risk changes",
          summary: "Notify material risk changes",
        })
      ).state
    ).toBe("needs_improvement");
  });

  it("passes meaningful 25–60 word guidance", () => {
    const q = assessGuidanceQuality(row({ summary: MEANINGFUL }));
    expect(q.state).toBe("meaningful_draft");
    expect(q.wordCount).toBeGreaterThanOrEqual(25);
    expect(q.wordCount).toBeLessThanOrEqual(90);
    expect(isMeaningfulGuidanceProse(row({ summary: MEANINGFUL }))).toBe(true);
  });

  it("flags complete but under-25-word guidance for Improve", () => {
    const short =
      "When planning tree works, check protection status and obtain consent before pruning or felling.";
    expect(
      assessGuidanceQuality(
        row({
          title: "Consent before protected tree works",
          summary: short,
          attributes: {
            applies_when: "Before pruning or felling a protected tree",
            legal_status: "Mandatory when triggered",
            action: "Check protection status and obtain consent",
          },
        })
      ).state
    ).toBe("needs_improvement");
    expect(needsGuidanceImprovement(
      row({
        title: "Consent before protected tree works",
        summary: short,
        attributes: {
          applies_when: "Before pruning or felling a protected tree",
          legal_status: "Mandatory when triggered",
          action: "Check protection status and obtain consent",
        },
      })
    )).toBe(true);
  });
});

describe("critic currency after guidance edit", () => {
  it("treats stale_after_guidance_edit as not current and enables Run critic", () => {
    const edited = row({
      summary: MEANINGFUL,
      provenance: {
        critic_at: "2026-08-01T00:00:00.000Z",
        critic_passed: false,
        critic_status: "stale_after_guidance_edit",
        critic_result: { verified: true },
        guidance_draft: {
          source: "human_edit",
          proposed_at: "2026-08-25T12:00:00.000Z",
          unverified: true,
        },
      },
      attributes: {
        legal_status: "Contractual / insurance",
        applies_when: "Material circumstances change",
        action: "Notify insurer",
        trigger_type: "event_driven",
        frequency: "When triggered",
      },
    });
    const critic = parseCriticSummary(edited, undefined, { sources: gov });
    expect(critic.status).toBe("stale");
    expect(critic.staleMessage).toMatch(/Guidance changed/i);
    expect(critic.isCurrent).toBe(false);

    const checks = buildReviewTrustChecks(edited, { sources: gov });
    expect(checks.find((c) => c.id === "contradiction")?.status).toBe("not_run");
    expect(canVerify(edited, checks)).toBe(false);
    expect(primaryActionForRow(edited, checks, gov).kind).toBe("run_critic");
  });

  it("does not allow Verify against a previous passed critic after draft change", () => {
    const stalePass = row({
      summary: MEANINGFUL,
      provenance: {
        critic_at: "2026-08-01T00:00:00.000Z",
        critic_passed: true,
        critic_status: "completed",
        critic_result: { verified: true, contradictions: "None." },
        guidance_draft: {
          source: "human_edit",
          proposed_at: "2026-08-25T12:00:00.000Z",
          unverified: true,
        },
      },
      attributes: {
        legal_status: "Contractual / insurance",
        applies_when: "Material circumstances change",
        trigger_type: "event_driven",
      },
    });
    const checks = buildTrustChecks(stalePass, { sources: gov });
    expect(canVerify(stalePass, checks)).toBe(false);
    expect(parseCriticSummary(stalePass).status).toBe("stale");
  });

  it("enables Verify when current critic passed and no other blockers", () => {
    const ready = row({
      summary: MEANINGFUL,
      provenance: {
        critic_at: new Date().toISOString(),
        critic_passed: true,
        critic_status: "completed",
        critic_result: {
          verified: true,
          claims_checked: "Notification duties",
          contradictions: "No contradictions found.",
          source_alignment: "Aligned with linked guidance",
        },
      },
      attributes: {
        legal_status: "Contractual / insurance",
        applies_when: "Material circumstances change",
        trigger_type: "event_driven",
        frequency: "When triggered",
      },
    });
    const checks = buildTrustChecks(ready, { sources: gov });
    expect(canVerify(ready, checks)).toBe(true);
    expect(primaryActionForRow(ready, checks, gov).kind).toBe("verify");
  });

  it("shows Review findings when current critic failed", () => {
    const failed = row({
      summary: MEANINGFUL,
      provenance: {
        critic_at: new Date().toISOString(),
        critic_passed: false,
        critic_status: "completed",
        critic_result: {
          verified: false,
          contradictions: "Guidance overstates insurance duty",
          required_corrections: "Remove unsupported claim",
        },
      },
      attributes: {
        legal_status: "Contractual / insurance",
        applies_when: "Material circumstances change",
        trigger_type: "event_driven",
      },
    });
    const checks = buildTrustChecks(failed, { sources: gov });
    expect(primaryActionForRow(failed, checks, gov).kind).toBe("review");
    expect(primaryActionForRow(failed, checks, gov).label).toBe("Review findings");
  });

  it("suppresses empty critic fields such as None.", () => {
    expect(formatCriticField("None.")).toBeNull();
    expect(formatCriticField("No contradictions found.")).toBe(
      "No contradictions found."
    );
    const critic = parseCriticSummary(
      row({
        summary: MEANINGFUL,
        provenance: {
          critic_at: new Date().toISOString(),
          critic_passed: true,
          critic_status: "completed",
          critic_result: {
            verified: true,
            claims_checked: "None.",
            contradictions: "None.",
            source_alignment: "Aligned",
          },
        },
      })
    );
    expect(critic.claimsChecked).toBeNull();
    expect(critic.contradictions).toBe("No contradictions found.");
  });
});

describe("AI-proposed draft remains unverified", () => {
  it("keeps guidance as draft and does not enable Verify without critic", () => {
    const ai = row({
      summary: MEANINGFUL,
      provenance: {
        guidance_draft: {
          source: "ai",
          unverified: true,
          proposed_at: new Date().toISOString(),
          label: "AI-proposed draft",
        },
      },
      attributes: {
        legal_status: "Contractual / insurance",
        applies_when: "Material circumstances change",
        trigger_type: "event_driven",
      },
    });
    expect(hasCanonicalGuidance(ai)).toBe(true);
    const checks = buildTrustChecks(ai, { sources: gov });
    expect(canVerify(ai, checks)).toBe(false);
    expect(primaryActionForRow(ai, checks, gov).kind).toBe("run_critic");
  });
});

describe("toolbar counts agree with row states", () => {
  it("counts missing, needs improvement, meaningful, awaiting critic", () => {
    const rows = [
      row({ id: "a", summary: null }),
      row({
        id: "b",
        summary: "Review policy and notify insurer as required",
      }),
      row({
        id: "c",
        summary: MEANINGFUL,
        attributes: {
          legal_status: "Contractual / insurance",
          applies_when: "Material circumstances change",
          trigger_type: "event_driven",
        },
      }),
    ];
    const map = new Map([
      ["a", gov],
      ["b", gov],
      ["c", gov],
    ]);
    const counts = computeReviewToolbarCounts(rows, map);
    expect(counts.missingGuidance).toBe(1);
    expect(counts.needingImprovement).toBe(1);
    expect(counts.meaningfulDraft).toBe(1);
    expect(counts.awaitingCritic).toBe(1);
  });
});

describe("legacy verified with invalidated checks", () => {
  it("does not treat weak verified guidance as publication-ready", () => {
    const legacy = row({
      status: "verified",
      reviewed_by: "admin-1",
      summary: "Review policy and notify insurer as required",
      provenance: {
        critic_at: new Date().toISOString(),
        critic_passed: true,
        critic_status: "completed",
      },
    });
    const checks = buildTrustChecks(legacy, { sources: gov });
    expect(checks.find((c) => c.id === "guidance")?.status).toBe("incomplete");
    expect(hasCanonicalGuidance(legacy)).toBe(false);
  });
});
