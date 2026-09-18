import { describe, expect, it } from "vitest";

/** Pure helper mirrored from syncTaskJunctionIds for unit coverage. */
function junctionDiff(existing: string[], desired: string[]) {
  const existingSet = new Set(existing.filter(Boolean));
  const desiredUnique = [...new Set(desired.filter((id) => Boolean(id) && !id.startsWith("ghost-")))];
  const desiredSet = new Set(desiredUnique);
  return {
    toRemove: [...existingSet].filter((id) => !desiredSet.has(id)),
    toAdd: desiredUnique.filter((id) => !existingSet.has(id)),
  };
}

describe("junctionDiff", () => {
  it("only inserts newly selected spaces", () => {
    expect(junctionDiff(["a"], ["a", "b"])).toEqual({
      toRemove: [],
      toAdd: ["b"],
    });
  });

  it("removes deselected spaces without reinserting kept ones", () => {
    expect(junctionDiff(["a", "b"], ["b"])).toEqual({
      toRemove: ["a"],
      toAdd: [],
    });
  });

  it("dedupes desired ids and ignores ghosts", () => {
    expect(junctionDiff([], ["a", "a", "ghost-1"])).toEqual({
      toRemove: [],
      toAdd: ["a"],
    });
  });
});
