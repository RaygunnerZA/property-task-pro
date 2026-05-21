import { describe, it, expect } from "vitest";
import { enrichSuggestionChipsWithEntities } from "../enrichSuggestionChipsWithEntities";
import type { SuggestedChip } from "@/types/chip-suggestions";

describe("enrichSuggestionChipsWithEntities", () => {
  it("resolves asset chip when Stove exists in property assets", () => {
    const chips: SuggestedChip[] = [
      {
        id: "asset-ghost-stove",
        type: "asset",
        value: "Stove",
        label: "Stove",
        score: 0.6,
        source: "rule",
        blockingRequired: true,
      },
    ];
    const enriched = enrichSuggestionChipsWithEntities(chips, {
      members: [],
      teams: [],
      spaces: [],
      assets: [{ id: "asset-stove-1", name: "Stove" }],
    });
    expect(enriched[0].resolvedEntityId).toBe("asset-stove-1");
    expect(enriched[0].blockingRequired).toBe(false);
  });

  it("keeps unresolved person invite when Bob is not a member", () => {
    const chips: SuggestedChip[] = [
      {
        id: "person-bob",
        type: "person",
        value: "Bob",
        label: "Bob",
        score: 0.72,
        source: "rule",
        blockingRequired: true,
      },
    ];
    const enriched = enrichSuggestionChipsWithEntities(chips, {
      members: [{ id: "m1", user_id: "u1", display_name: "Bobby Hill" }],
      teams: [],
      spaces: [],
      assets: [],
    });
    expect(enriched[0].blockingRequired).toBe(true);
    expect(enriched[0].resolvedEntityId).toBeUndefined();
  });
});
