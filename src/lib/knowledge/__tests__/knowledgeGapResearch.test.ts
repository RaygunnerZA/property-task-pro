import { describe, expect, it } from "vitest";
import { EMPTY_APPLICABILITY } from "@/types/knowledge";
import type { ProposedKnowledgeCandidate } from "@/lib/knowledge/knowledgeDocumentIntake";
import {
  applyGapApplicabilityToProposals,
  uniqueTopicLabel,
} from "@/lib/knowledge/knowledgeGapResearch";
import {
  augmentDiscoveryWithCuratedSources,
  parseResearchGapsBody,
  sanitiseResearchSourceUrl,
  validateDiscoverySources,
} from "../../../../supabase/functions/_shared/knowledgeGapResearch.ts";
import { SchemaError } from "../../../../supabase/functions/_shared/aiRouting.ts";

function proposal(partial: Partial<ProposedKnowledgeCandidate> = {}): ProposedKnowledgeCandidate {
  return {
    clientId: "c1",
    title: "Fire safety",
    summary: "Summary",
    body: "Body",
    attributes: {},
    claims: [],
    provenance: {},
    applicability: { ...EMPTY_APPLICABILITY },
    selected: false,
    ...partial,
  };
}

describe("sanitiseResearchSourceUrl", () => {
  it("accepts https URLs", () => {
    expect(sanitiseResearchSourceUrl("https://www.gov.uk/fire-safety")).toBe(
      "https://www.gov.uk/fire-safety"
    );
  });

  it("rejects http, credentials, and localhost", () => {
    expect(sanitiseResearchSourceUrl("http://www.gov.uk/fire-safety")).toBeNull();
    expect(sanitiseResearchSourceUrl("https://user:pass@www.gov.uk/x")).toBeNull();
    expect(sanitiseResearchSourceUrl("https://localhost/x")).toBeNull();
    expect(sanitiseResearchSourceUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("parseResearchGapsBody", () => {
  const gap = {
    id: "fire_safety::Scotland",
    topic_key: "fire_safety",
    topic: "Fire safety",
    jurisdiction: "Scotland",
    status: "missing",
  };

  it("accepts a valid batch", () => {
    expect(parseResearchGapsBody({ gaps: [gap] })).toEqual([gap]);
  });

  it("rejects oversized or empty batches", () => {
    expect(() => parseResearchGapsBody({ gaps: [] })).toThrow(SchemaError);
    expect(() =>
      parseResearchGapsBody({
        gaps: Array.from({ length: 21 }, (_, i) => ({
          ...gap,
          id: `fire_safety::J${i}`,
          jurisdiction: `J${i}`,
        })),
      })
    ).toThrow(SchemaError);
  });

  it("drops gaps whose id does not match topic_key", () => {
    expect(() =>
      parseResearchGapsBody({
        gaps: [{ ...gap, id: "other::Scotland" }],
      })
    ).toThrow(SchemaError);
  });
});

describe("validateDiscoverySources", () => {
  const allowed = new Set(["fire_safety::Scotland", "fire_safety::Wales"]);

  it("keeps https sources that cover allowed gap ids and reports uncovered", () => {
    const result = validateDiscoverySources(
      {
        sources: [
          {
            url: "https://www.gov.uk/fire-safety",
            title: "Fire safety",
            publisher: "UK Government",
            authority: "government_guidance",
            covers: ["fire_safety::Scotland", "invented::gap"],
          },
        ],
      },
      allowed
    );
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].covers).toEqual(["fire_safety::Scotland"]);
    expect(result.uncovered).toEqual(["fire_safety::Wales"]);
  });

  it("drops sources with no valid covers", () => {
    const result = validateDiscoverySources(
      {
        sources: [{ url: "https://www.gov.uk/x", covers: ["nope"] }],
      },
      allowed
    );
    expect(result.sources).toHaveLength(0);
    expect(result.uncovered).toEqual(["fire_safety::Scotland", "fire_safety::Wales"]);
  });

  it("rejects non-allowlisted hosts as source needs repair material", () => {
    const result = validateDiscoverySources(
      {
        sources: [
          {
            url: "https://www.legislation.gouv.fr/",
            title: "Bad FR host",
            covers: ["fire_safety::Scotland"],
          },
          {
            url: "https://example.com/x",
            title: "Blog",
            covers: ["fire_safety::Wales"],
          },
        ],
      },
      allowed
    );
    // Typo host is repaired to legifrance and kept.
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].url).toContain("legifrance.gouv.fr");
    expect(result.rejected.some((r) => r.url.includes("example.com"))).toBe(true);
  });
});

describe("applyGapApplicabilityToProposals", () => {
  it("unions jurisdictions and selects proposals", () => {
    const next = applyGapApplicabilityToProposals(
      [proposal({ applicability: { ...EMPTY_APPLICABILITY, jurisdictions: ["England"] } })],
      ["Scotland", "England"],
      "Fire safety"
    );
    expect(next[0].selected).toBe(true);
    expect(next[0].applicability.jurisdictions).toEqual(["England", "Scotland"]);
    expect(next[0].attributes.category).toBe("Fire safety");
  });

  it("returns a single topic label only when all match", () => {
    expect(uniqueTopicLabel(["Fire safety", "Fire safety"])).toBe("Fire safety");
    expect(uniqueTopicLabel(["Fire safety", "Gas"])).toBeUndefined();
  });
});

describe("augmentDiscoveryWithCuratedSources", () => {
  it("prepends verified England/Scotland chimney URLs when the model invents nothing usable", () => {
    const gaps = parseResearchGapsBody({
      gaps: [
        {
          id: "chimney-flue-sweeping::england",
          topic_key: "chimney-flue-sweeping",
          topic: "Chimney and flue sweeping",
          jurisdiction: "England",
          status: "partial",
        },
        {
          id: "chimney-flue-sweeping::scotland",
          topic_key: "chimney-flue-sweeping",
          topic: "Chimney and flue sweeping",
          jurisdiction: "Scotland",
          status: "partial",
        },
      ],
    });

    const augmented = augmentDiscoveryWithCuratedSources(gaps, []);
    expect(augmented.curatedAdded).toBe(2);
    expect(augmented.uncovered).toEqual([]);
    expect(augmented.sources.some((s) => s.url.includes("approved-document-j"))).toBe(true);
    expect(augmented.sources.some((s) => s.url.includes("gov.scot"))).toBe(true);
  });

  it("keeps curated ahead of model URLs so intake prefers known-good pages", () => {
    const gaps = parseResearchGapsBody({
      gaps: [
        {
          id: "chimney-flue-sweeping::england",
          topic_key: "chimney-flue-sweeping",
          topic: "Chimney",
          jurisdiction: "England",
          status: "missing",
        },
      ],
    });
    const modelDead: Parameters<typeof augmentDiscoveryWithCuratedSources>[1] = [
      {
        url: "https://www.gov.uk/this-path-does-not-exist-chimney-404",
        title: "Hallucinated",
        publisher: "UK government",
        authority: "government_guidance",
        covers: ["chimney-flue-sweeping::england"],
      },
    ];
    const augmented = augmentDiscoveryWithCuratedSources(gaps, modelDead);
    expect(augmented.sources).toHaveLength(1);
    expect(augmented.sources[0].url).toContain("approved-document-j");
  });

  it("replaces invented heating-season 404s with curated HSE / Service-Public URLs", () => {
    const gaps = parseResearchGapsBody({
      gaps: [
        {
          id: "before-heating-season::england",
          topic_key: "before-heating-season",
          topic: "Before the heating season",
          jurisdiction: "England",
          status: "partial",
        },
        {
          id: "before-heating-season::france",
          topic_key: "before-heating-season",
          topic: "Before the heating season",
          jurisdiction: "France",
          status: "partial",
        },
      ],
    });
    const invented = [
      {
        url: "https://www.gov.uk/government/publications/guide-to-the-heating-season",
        title: "Fake UK guide",
        publisher: "UK government",
        authority: "government_guidance" as const,
        covers: ["before-heating-season::england"],
      },
      {
        url: "https://www.service-public.fr/particuliers/vosdroits/F19873",
        title: "Fake FR droit",
        publisher: "Service-Public",
        authority: "government_guidance" as const,
        covers: ["before-heating-season::france"],
      },
    ];
    const augmented = augmentDiscoveryWithCuratedSources(gaps, invented);
    expect(augmented.sources.every((s) => !s.url.includes("guide-to-the-heating-season"))).toBe(
      true
    );
    expect(augmented.sources.every((s) => !s.url.includes("F19873"))).toBe(true);
    expect(augmented.sources.some((s) => s.url.includes("hse.gov.uk"))).toBe(true);
    expect(augmented.sources.some((s) => s.url.includes("F20760"))).toBe(true);
  });
});
