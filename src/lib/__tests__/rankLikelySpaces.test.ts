import { describe, expect, it } from "vitest";
import { rankLikelySpaces } from "../rankLikelySpaces";

const SPACES = [
  { id: "1", name: "Kitchen" },
  { id: "2", name: "Pool Tech Room" },
  { id: "3", name: "Pool Plant Room" },
  { id: "4", name: "Santa En Suite" },
  { id: "5", name: "Roof" },
  { id: "6", name: "Basement" },
];

describe("rankLikelySpaces", () => {
  it("returns empty when there is no signal", () => {
    expect(rankLikelySpaces({ spaces: SPACES })).toEqual([]);
  });

  it("ranks spaces mentioned in context text", () => {
    const result = rankLikelySpaces({
      spaces: SPACES,
      contextText: "Leak in the pool tech room near the plant",
      limit: 4,
    });
    expect(result.map((s) => s.name)).toContain("Pool Tech Room");
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it("prefers suggested entity ids", () => {
    const result = rankLikelySpaces({
      spaces: SPACES,
      suggestedEntityIds: ["5"],
      limit: 3,
    });
    expect(result[0]?.id).toBe("5");
  });

  it("always includes selected spaces first", () => {
    const result = rankLikelySpaces({
      spaces: SPACES,
      selectedIds: ["6"],
      suggestedEntityIds: ["5"],
      limit: 3,
    });
    expect(result[0]?.id).toBe("6");
    expect(result.map((s) => s.id)).toContain("5");
  });

  it("does not dump the full catalog", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `s${i}`,
      name: `Space ${i}`,
    }));
    const result = rankLikelySpaces({
      spaces: many,
      contextText: "Space 7 needs attention",
      limit: 8,
    });
    expect(result.length).toBeLessThanOrEqual(8);
    expect(result.some((s) => s.name === "Space 7")).toBe(true);
  });
});
