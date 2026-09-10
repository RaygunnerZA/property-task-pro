import { describe, expect, it } from "vitest";
import {
  applyHumanVerifiedSeoClearance,
  buildEvidenceResearchFingerprint,
  classifyEvidenceBlocker,
  mapKnowledgeGapsToResearchInputs,
  mergeResearchMetaIntoSeoCurrent,
  readResearchMetaFromSeoCurrent,
  researchProgressCopy,
  shouldAutoKickEvidenceResearch,
} from "@/lib/content/contentEvidenceResearch";
import {
  getGroundingRemedies,
  getSeoReadiness,
  normalizeStageEnvelope,
} from "@/lib/content/contentTopicWorkflow";

describe("contentEvidenceResearch", () => {
  const pendingWithGaps = normalizeStageEnvelope({
    approval_status: "pending",
    current: {
      primary_keyword: "chimney sweeping",
      evidence_gaps: ["How often must flues be swept?"],
      research_warnings: ["Verify claim against source"],
    },
  });

  const sourceUnavailable = normalizeStageEnvelope({
    approval_status: "pending",
    current: {
      primary_keyword: "chimney sweeping",
      evidence_gaps: ["Source content unavailable"],
      research_warnings: ["source_content_unavailable"],
    },
  });

  it("classifies ready when SEO can approve", () => {
    const approved = normalizeStageEnvelope({
      approval_status: "approved",
      current: { primary_keyword: "x" },
      approved: { primary_keyword: "x" },
    });
    expect(
      classifyEvidenceBlocker({
        readiness: getSeoReadiness(approved),
        hasUsableSourceUrl: true,
      })
    ).toBe("ready");
  });

  it("classifies retrieve when source unavailable and no URL", () => {
    expect(
      classifyEvidenceBlocker({
        readiness: getSeoReadiness(sourceUnavailable),
        hasUsableSourceUrl: false,
      })
    ).toBe("retrieve");
  });

  it("classifies research_pack when source unavailable but URL exists", () => {
    expect(
      classifyEvidenceBlocker({
        readiness: getSeoReadiness(sourceUnavailable),
        hasUsableSourceUrl: true,
      })
    ).toBe("research_pack");
  });

  it("classifies verify_only when gaps match unverified claims", () => {
    const gap = "How often must flues be swept?";
    const env = normalizeStageEnvelope({
      approval_status: "pending",
      current: {
        primary_keyword: "chimney",
        evidence_gaps: [gap],
        research_warnings: ["Verify claim"],
      },
    });
    expect(
      classifyEvidenceBlocker({
        readiness: getSeoReadiness(env),
        hasUsableSourceUrl: true,
        claims: [{ claim_text: gap, verification_status: "extracted" }],
      })
    ).toBe("verify_only");
  });

  it("classifies research_pack when knowledge gaps need new evidence", () => {
    expect(
      classifyEvidenceBlocker({
        readiness: getSeoReadiness(pendingWithGaps),
        hasUsableSourceUrl: true,
        claims: [],
      })
    ).toBe("research_pack");
  });

  it("builds stable fingerprints for identical gaps", () => {
    const a = buildEvidenceResearchFingerprint({
      topicId: "t1",
      knowledgeId: "k1",
      knowledgeGaps: ["B", "A"],
      sourceUnavailable: false,
    });
    const b = buildEvidenceResearchFingerprint({
      topicId: "t1",
      knowledgeId: "k1",
      knowledgeGaps: ["a", "b"],
      sourceUnavailable: false,
    });
    expect(a).toBe(b);
  });

  it("skips auto-kick for same fingerprint in awaiting_human", () => {
    const fingerprint = "t::k::0::gap";
    expect(
      shouldAutoKickEvidenceResearch({
        fingerprint,
        meta: { research_status: "awaiting_human", research_fingerprint: fingerprint },
      })
    ).toBe(false);
    expect(
      shouldAutoKickEvidenceResearch({
        fingerprint,
        meta: { research_status: "failed", research_fingerprint: fingerprint },
      })
    ).toBe(false);
    expect(
      shouldAutoKickEvidenceResearch({
        fingerprint: "other",
        meta: { research_status: "awaiting_human", research_fingerprint: fingerprint },
      })
    ).toBe(true);
    expect(
      shouldAutoKickEvidenceResearch({
        fingerprint: "new-after-seo-regen",
        meta: { research_status: "human_verified", research_fingerprint: fingerprint },
      })
    ).toBe(false);
  });

  it("maps gaps for discovery without inventing columns", () => {
    const gaps = mapKnowledgeGapsToResearchInputs({
      topicId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      knowledgeTitle: "Chimney / flue sweeping",
      jurisdiction: "ZA",
      knowledgeGaps: ["Interval", "Who is responsible"],
    });
    expect(gaps).toHaveLength(2);
    expect(gaps[0]?.id).toBe("content:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:0");
    expect(gaps[0]?.jurisdiction).toBe("ZA");
  });

  it("merges research meta into SEO current without dropping proposal fields", () => {
    const merged = mergeResearchMetaIntoSeoCurrent(
      { primary_keyword: "chimney", evidence_gaps: ["x"] },
      { research_status: "running", research_fingerprint: "fp" }
    );
    expect(merged.primary_keyword).toBe("chimney");
    expect(merged.evidence_gaps).toEqual(["x"]);
    expect(merged.research_status).toBe("running");
  });

  it("reads research meta from SEO current", () => {
    expect(
      readResearchMetaFromSeoCurrent({
        research_status: "awaiting_human",
        research_fingerprint: "fp",
        research_remaining_gaps: ["still missing"],
      }).research_remaining_gaps
    ).toEqual(["still missing"]);
  });

  it("surfaces progress copy for pack and human verify", () => {
    expect(researchProgressCopy({ phase: "packing" })).toMatch(/evidence pack/i);
    expect(
      researchProgressCopy({
        phase: "idle",
        meta: { research_status: "awaiting_human" },
      })
    ).toMatch(/Verify claims/i);
  });

  it("clears soft gaps after human verify so Approve SEO is reachable", () => {
    const cleared = applyHumanVerifiedSeoClearance({
      primary_keyword: "chimney sweeping",
      evidence_gaps: ["How often must flues be swept?"],
      research_warnings: ["Verify claim against source"],
    });
    expect(cleared.evidence_gaps).toEqual([]);
    expect(cleared.research_warnings).toEqual([]);
    expect(cleared.research_status).toBe("human_verified");
    expect(
      getSeoReadiness(
        normalizeStageEnvelope({
          approval_status: "pending",
          current: cleared,
        })
      ).canApprove
    ).toBe(true);
  });

  it("keeps source issues when applying human verify clearance", () => {
    const cleared = applyHumanVerifiedSeoClearance({
      primary_keyword: "chimney sweeping",
      evidence_gaps: ["Source content unavailable", "Interval unknown"],
      research_warnings: ["check"],
      source_content_unavailable: true,
    });
    expect(cleared.evidence_gaps).toEqual(["Source content unavailable"]);
    expect(cleared.source_content_unavailable).toBe(true);
    expect(cleared.research_status).toBe("human_verified");
  });
  it("enables research_evidence remedy", () => {
    const readiness = getSeoReadiness(pendingWithGaps);
    const { remedies } = getGroundingRemedies(readiness);
    const research = remedies.find((r) => r.id === "research_evidence");
    expect(research?.available).toBe(true);
  });
});
