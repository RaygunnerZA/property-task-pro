import { describe, expect, it } from "vitest";
import { SchemaError } from "../../../../supabase/functions/_shared/aiRouting.ts";
import {
  AI_BATCH_CAPABILITIES,
  AI_BATCH_ENABLED_CAPABILITIES,
  BATCH_PRICE_MULTIPLIER,
  MAX_GUIDANCE_BATCH_ITEMS,
  contentStageToBatchCapability,
  isAiBatchCapabilityEnabled,
  parseAiBatchSubmitBody,
} from "../../../../supabase/functions/_shared/aiBatch.ts";
import {
  applyBatchUsdDiscount,
  estimateCost,
} from "../../../../supabase/functions/_shared/aiObservability.ts";
import { validateDraft } from "../../../../supabase/functions/_shared/knowledgeGuidanceDraft.ts";

const K1 = "11111111-1111-1111-1111-111111111111";
const K2 = "22222222-2222-2222-2222-222222222222";

describe("ai batch capabilities", () => {
  it("includes Knowledge and Content capabilities in one union", () => {
    expect(AI_BATCH_CAPABILITIES).toEqual(
      expect.arrayContaining([
        "knowledge_guidance_draft",
        "knowledge_gap_research",
        "content_seo_draft",
        "content_brief_draft",
        "content_output_draft",
        "content_visual_brief",
      ])
    );
  });

  it("enables only Knowledge capabilities today", () => {
    expect(AI_BATCH_ENABLED_CAPABILITIES).toEqual([
      "knowledge_guidance_draft",
      "knowledge_gap_research",
    ]);
    expect(isAiBatchCapabilityEnabled("knowledge_guidance_draft")).toBe(true);
    expect(isAiBatchCapabilityEnabled("content_seo_draft")).toBe(false);
  });

  it("maps Content stages onto the same capability ids", () => {
    expect(contentStageToBatchCapability("seo")).toBe("content_seo_draft");
    expect(contentStageToBatchCapability("brief")).toBe("content_brief_draft");
    expect(contentStageToBatchCapability("output")).toBe("content_output_draft");
    expect(contentStageToBatchCapability("visual_concept")).toBe("content_visual_brief");
    expect(contentStageToBatchCapability("visual_final")).toBeNull();
  });
});

describe("parseAiBatchSubmitBody", () => {
  it("accepts guidance ids and caps at 80", () => {
    const parsed = parseAiBatchSubmitBody({
      capability: "knowledge_guidance_draft",
      mode: "improve",
      knowledge_ids: [K1, K2, K1],
    });
    expect(parsed).toEqual({
      capability: "knowledge_guidance_draft",
      mode: "improve",
      items: [{ knowledge_id: K1 }, { knowledge_id: K2 }],
    });
    const tooMany = Array.from({ length: MAX_GUIDANCE_BATCH_ITEMS + 1 }, (_, i) => {
      const n = (i + 1).toString(16).padStart(12, "0");
      return `11111111-1111-1111-1111-${n}`;
    });
    expect(() =>
      parseAiBatchSubmitBody({
        capability: "knowledge_guidance_draft",
        knowledge_ids: tooMany,
      })
    ).toThrow(SchemaError);
  });

  it("rejects verify-like modes and unknown capabilities", () => {
    expect(() =>
      parseAiBatchSubmitBody({ capability: "knowledge_guidance_draft", mode: "verify" })
    ).toThrow(SchemaError);
    expect(() => parseAiBatchSubmitBody({ capability: "knowledge_critique" })).toThrow(
      SchemaError
    );
  });

  it("parses research gaps through the existing contract", () => {
    const parsed = parseAiBatchSubmitBody({
      capability: "knowledge_gap_research",
      gaps: [
        {
          id: "fire_safety::Scotland",
          topic_key: "fire_safety",
          topic: "Fire safety",
          jurisdiction: "Scotland",
          status: "missing",
        },
      ],
    });
    expect(parsed.capability).toBe("knowledge_gap_research");
    expect(parsed.mode).toBe("research");
    expect(parsed.items).toHaveLength(1);
  });

  it("parses Content items so the union stays stable", () => {
    const parsed = parseAiBatchSubmitBody({
      capability: "content_seo_draft",
      topic_id: K1,
    });
    expect(parsed.capability).toBe("content_seo_draft");
    expect(parsed.mode).toBe("seo");
    expect(isAiBatchCapabilityEnabled(parsed.capability)).toBe(false);
  });
});

describe("batch pricing", () => {
  it("halves interactive USD estimates", () => {
    expect(BATCH_PRICE_MULTIPLIER).toBe(0.5);
    const full = estimateCost("gemini-3.6-flash", 1000, 1000);
    expect(full).not.toBeNull();
    expect(applyBatchUsdDiscount(full)).toBeCloseTo(full! * 0.5);
    expect(applyBatchUsdDiscount(null)).toBeNull();
  });
});

describe("validateDraft (shared with batch apply)", () => {
  it("rejects empty, URL, and generic commentary", () => {
    expect(() => validateDraft({ summary: "short" })).toThrow(SchemaError);
    expect(() => validateDraft({ summary: "https://example.com/guidance-here" })).toThrow(
      SchemaError
    );
    expect(() =>
      validateDraft({
        summary: "This knowledge provides overall this is reliable information for owners.",
      })
    ).toThrow(SchemaError);
  });

  it("accepts homeowner prose", () => {
    expect(
      validateDraft({
        summary:
          "Before pruning a protected tree in England, check with the local planning authority whether a TPO or conservation-area consent is required.",
      }).summary.length
    ).toBeGreaterThan(12);
  });
});
