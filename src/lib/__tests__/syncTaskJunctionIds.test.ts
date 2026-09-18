import { describe, expect, it } from "vitest";

/** Pure helper mirrored from syncTaskJunctionIds for unit coverage. */
function junctionDiff(existing: string[], desired: string[]) {
  const existingSet = new Set(existing.filter(Boolean));
  const desiredUnique = [...new Set(desired.filter((id) => Boolean(id) && !id.startsWith("ghost-")))];
  const desiredSet = new Set(desiredUnique);
  return {
    toRemove: [...existingSet].filter((id) => !desiredSet.has(id)),
    toAdd: desiredUnique.filter((id) => !existingSet.has(id)),
    spaceIdsMirror: desiredUnique,
  };
}

describe("junctionDiff", () => {
  it("only inserts newly selected spaces", () => {
    expect(junctionDiff(["a"], ["a", "b"])).toEqual({
      toRemove: [],
      toAdd: ["b"],
      spaceIdsMirror: ["a", "b"],
    });
  });

  it("removes deselected spaces without reinserting kept ones", () => {
    expect(junctionDiff(["a", "b"], ["b"])).toEqual({
      toRemove: ["a"],
      toAdd: [],
      spaceIdsMirror: ["b"],
    });
  });

  it("dedupes desired ids and ignores ghosts", () => {
    expect(junctionDiff([], ["a", "a", "ghost-1"])).toEqual({
      toRemove: [],
      toAdd: ["a"],
      spaceIdsMirror: ["a"],
    });
  });

  it("mirrors desired ids onto tasks.space_ids (tasks_view source)", () => {
    expect(junctionDiff([], ["attic"]).spaceIdsMirror).toEqual(["attic"]);
  });
});
