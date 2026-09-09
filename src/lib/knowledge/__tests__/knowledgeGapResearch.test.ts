import { describe, expect, it } from "vitest";
import { EMPTY_APPLICABILITY } from "@/types/knowledge";
import type { ProposedKnowledgeCandidate } from "@/lib/knowledge/knowledgeDocumentIntake";
import {
  applyGapApplicabilityToProposals,
  uniqueTopicLabel,
} from "@/lib/knowledge/knowledgeGapResearch";
import {
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
        sources: [{ url: "https://example.com/x", covers: ["nope"] }],
      },
      allowed
    );
    expect(result.sources).toHaveLength(0);
    expect(result.uncovered).toEqual(["fire_safety::Scotland", "fire_safety::Wales"]);
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
