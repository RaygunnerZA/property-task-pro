import { describe, expect, it } from "vitest";
import { CAPABILITIES, STRATEGIES } from "../../../../supabase/functions/_shared/aiRouting.ts";
import { AI_CAPABILITY_IDS, AI_CAPABILITY_META, AI_STRATEGY_IDS } from "../routeCatalog";

describe("admin route catalog matches compiled routing", () => {
  it("lists every capability", () => {
    expect([...AI_CAPABILITY_IDS].sort()).toEqual(Object.keys(CAPABILITIES).sort());
  });

  it("lists every approved strategy", () => {
    expect([...AI_STRATEGY_IDS].sort()).toEqual(Object.keys(STRATEGIES).sort());
  });

  it("uses the compiled first strategy as the displayed default", () => {
    for (const id of AI_CAPABILITY_IDS) {
      expect(AI_CAPABILITY_META[id].compiledPrimary).toBe(CAPABILITIES[id].order[0]);
      expect(AI_CAPABILITY_META[id].functionName).toBe(CAPABILITIES[id].functionName);
    }
  });
});
