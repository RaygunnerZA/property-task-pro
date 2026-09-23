import { describe, expect, it } from "vitest";
import {
  checkResearchAllowance,
  dedupeSubjectKey,
  deriveDiscoverySignals,
  packageMatchesSourceFilter,
  shouldDeepResearch,
  topReasonChips,
  type WatchUsage,
} from "@/lib/content/knowledgeWatch";
import {
  buildSubjectPackages,
  packagesForFilter,
} from "@/lib/content/knowledgeSubjectPackage";
import type { KnowledgeRow } from "@/types/knowledge";

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

const emptyUsage = (overrides: Partial<WatchUsage> = {}): WatchUsage => ({
  period_ym: "2026-09",
  searches_used: 0,
  pages_used: 0,
  tokens_used: 0,
  cost_units_used: 0,
  ...overrides,
});

describe("discovery signal attribution", () => {
  it("attributes Watch provenance seasonal and knowledge_gap change kinds", () => {
    const signals = deriveDiscoverySignals({
      subjectKey: "party-walls",
      title: "Party walls",
      sourceKinds: ["filla_curated"],
      knowledgeStatuses: ["candidate"],
      heatingSeason: false,
      coverageIncomplete: false,
      provenanceHints: [
        {
          changeKind: "knowledge_gap",
          label: "Knowledge gap",
          detectedAt: "2026-09-17T00:00:00Z",
        },
      ],
    });
    expect(signals.some((s) => s.type === "knowledge_gap")).toBe(true);
  });

  it("attributes seasonal + gap without inventing confirmed regulatory updates", () => {
    const signals = deriveDiscoverySignals({
      subjectKey: "before-heating-season",
      title: "Before the heating season",
      sourceKinds: ["filla_curated"],
      knowledgeStatuses: ["stale", "candidate"],
      whyNow: "Heating-season opportunity",
      windowLabel: "Before heating season",
      heatingSeason: true,
      coverageIncomplete: true,
      now: new Date("2026-09-15T12:00:00Z"),
    });
    expect(signals.some((s) => s.type === "seasonal")).toBe(true);
    expect(signals.some((s) => s.type === "knowledge_gap")).toBe(true);
    const guidance = signals.find((s) => s.type === "official_guidance");
    expect(guidance?.confidence).toBe("inferred");
    expect(guidance?.observation.toLowerCase()).toContain("not a confirmed");
    expect(signals.some((s) => s.type === "regulatory_update")).toBe(false);
  });

  it("attributes confirmed regulatory updates only from provenance hints", () => {
    const signals = deriveDiscoverySignals({
      subjectKey: "party-walls",
      title: "Party walls",
      sourceKinds: ["filla_curated"],
      knowledgeStatuses: ["verified"],
      heatingSeason: false,
      coverageIncomplete: false,
      provenanceHints: [
        {
          url: "https://example.gov/party-walls",
          label: "Statute amended",
          changeKind: "regulatory",
          detectedAt: "2026-09-10T00:00:00Z",
        },
      ],
    });
    const reg = signals.find((s) => s.type === "regulatory_update");
    expect(reg?.confidence).toBe("high");
    expect(reg?.sourceUrls).toEqual(["https://example.gov/party-walls"]);
  });

  it("labels news and consultations as Potential change, not regulatory_update", () => {
    const signals = deriveDiscoverySignals({
      subjectKey: "smoke-carbon-monoxide-alarms",
      title: "Smoke and carbon monoxide alarms",
      sourceKinds: ["filla_curated"],
      knowledgeStatuses: ["published"],
      heatingSeason: false,
      coverageIncomplete: false,
      provenanceHints: [
        {
          url: "https://www.gov.uk/government/news/private-renting",
          label: "MHCLG announced proposed changes",
          changeKind: "potential_change",
          detectedAt: "2026-09-22T00:00:00Z",
        },
      ],
    });
    expect(signals.some((s) => s.type === "potential_change")).toBe(true);
    expect(signals.some((s) => s.type === "regulatory_update")).toBe(false);
    expect(signals.find((s) => s.type === "potential_change")?.label).toBe("Potential change");
  });

  it("shows strongest one or two reason chips", () => {
    const chips = topReasonChips(
      deriveDiscoverySignals({
        subjectKey: "before-heating-season",
        title: "Heating",
        sourceKinds: ["operational_discovery"],
        knowledgeStatuses: ["candidate"],
        heatingSeason: true,
        coverageIncomplete: true,
      }),
      2
    );
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.length).toBeLessThanOrEqual(2);
  });
});

describe("source filter × workflow filter", () => {
  it("includes a subject when any of its signals match", () => {
    const packages = buildSubjectPackages({
      knowledge: [
        knowledge({
          id: "k1",
          title: "Boiler service — France",
          status: "verified",
          source_kind: "operational_discovery",
          applicability: { jurisdictions: ["France"], regions: [], languages: [], audiences: [] },
        }),
      ],
      topics: [],
      now: new Date("2026-09-15T12:00:00Z"),
    });
    const pkg = packages.find((p) => p.subjectKey === "before-heating-season");
    expect(pkg).toBeTruthy();
    expect(packageMatchesSourceFilter(pkg!.discoverySignals, "property_work_pattern")).toBe(true);
    expect(packageMatchesSourceFilter(pkg!.discoverySignals, "user_demand")).toBe(false);

    const seasonal = packagesForFilter(packages, "monitoring", "seasonal");
    expect(seasonal.some((p) => p.subjectKey === "before-heating-season")).toBe(true);

    const demand = packagesForFilter(packages, "monitoring", "user_demand");
    expect(demand.some((p) => p.subjectKey === "before-heating-season")).toBe(false);
  });
});

describe("deduplication", () => {
  it("merges into an existing subject key", () => {
    expect(
      dedupeSubjectKey("before-heating-season", "Boiler service", [
        { subjectKey: "before-heating-season", title: "Before the heating season" },
      ])
    ).toEqual({ action: "merge", subjectKey: "before-heating-season" });
  });

  it("creates a new key when no match", () => {
    expect(
      dedupeSubjectKey("party-walls", "Party walls", [
        { subjectKey: "before-heating-season", title: "Heating" },
      ])
    ).toEqual({ action: "new", subjectKey: "party-walls" });
  });
});

describe("research allowance + pause", () => {
  it("blocks scheduled runs when paused", () => {
    const result = checkResearchAllowance({
      automatedResearch: "paused",
      allowance: "light",
      usage: emptyUsage(),
      trigger: "scheduled",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("paused");
  });

  it("allows manual Run Watch now while paused, until allowance is exhausted", () => {
    const ok = checkResearchAllowance({
      automatedResearch: "paused",
      allowance: "light",
      usage: emptyUsage(),
      trigger: "manual",
      need: { searches: 1 },
    });
    expect(ok.ok).toBe(true);

    const exhausted = checkResearchAllowance({
      automatedResearch: "on",
      allowance: "light",
      usage: emptyUsage({ searches_used: 20 }),
      trigger: "manual",
      need: { searches: 1 },
    });
    expect(exhausted.ok).toBe(false);
    if (!exhausted.ok) expect(exhausted.reason).toBe("searches");
  });

  it("resumes after authorised allowance increase", () => {
    const atLightCap = checkResearchAllowance({
      automatedResearch: "on",
      allowance: "light",
      usage: emptyUsage({ searches_used: 20 }),
      trigger: "scheduled",
      need: { searches: 1 },
    });
    expect(atLightCap.ok).toBe(false);

    const afterUpgrade = checkResearchAllowance({
      automatedResearch: "on",
      allowance: "standard",
      usage: emptyUsage({ searches_used: 20 }),
      trigger: "scheduled",
      need: { searches: 1 },
    });
    expect(afterUpgrade.ok).toBe(true);
  });
});

describe("cheap research gate", () => {
  it("skips deep research for inferred-only or already-covered subjects", () => {
    expect(
      shouldDeepResearch({
        hasKnownKnowledgeMatch: true,
        signals: [],
      }).research
    ).toBe(false);

    expect(
      shouldDeepResearch({
        hasKnownKnowledgeMatch: false,
        signals: [
          {
            type: "official_guidance",
            label: "Possible guidance drift",
            observation: "inferred",
            confidence: "inferred",
            detectedAt: null,
            sourceUrls: [],
            strength: 10,
          },
        ],
      }).research
    ).toBe(false);
  });

  it("does not treat Potential change as a reason to rewrite Knowledge", () => {
    const result = shouldDeepResearch({
      hasKnownKnowledgeMatch: true,
      signals: [
        {
          type: "potential_change",
          label: "Potential change",
          observation: "Consultation announced",
          confidence: "medium",
          detectedAt: "2026-09-22T00:00:00Z",
          sourceUrls: ["https://www.gov.uk/government/news/x"],
          strength: 50,
        },
      ],
    });
    expect(result.research).toBe(false);
    expect(result.skipReason?.toLowerCase()).toContain("potential change");
  });
});
