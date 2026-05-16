import { describe, it, expect } from "vitest";
import { mergeAiPeopleIntoChips } from "../mergeAiPeopleChips";
import type { SuggestedChip } from "@/types/chip-suggestions";

describe("mergeAiPeopleIntoChips", () => {
  it("adds invite chips for unknown AI people", () => {
    const merged = mergeAiPeopleIntoChips([], [
      { name: "Frank", exists: false },
      { name: "Bianca", exists: false },
    ]);
    const people = merged.filter((c) => c.type === "person");
    expect(people).toHaveLength(2);
    expect(people.every((c) => c.blockingRequired && !c.resolvedEntityId)).toBe(true);
    expect(people.map((c) => c.label)).toEqual(["Frank", "Bianca"]);
  });

  it("skips people already detected by rules", () => {
    const existing: SuggestedChip[] = [
      {
        id: "person-ghost-subject-frank",
        type: "person",
        value: "Frank",
        label: "Frank",
        score: 0.7,
        source: "rule",
        blockingRequired: true,
      },
    ];
    const merged = mergeAiPeopleIntoChips(existing, [{ name: "Frank", exists: false }]);
    expect(merged.filter((c) => c.type === "person")).toHaveLength(1);
  });

  it("adds resolved chip for existing org member from AI", () => {
    const merged = mergeAiPeopleIntoChips([], [
      { name: "Frank Smith", exists: true, id: "user-1" },
    ]);
    const frank = merged.find((c) => c.resolvedEntityId === "user-1");
    expect(frank).toBeDefined();
    expect(frank?.blockingRequired).toBe(false);
  });
});
