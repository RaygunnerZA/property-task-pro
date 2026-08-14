import { describe, expect, it } from "vitest";
import { findAdjacentIdsInOrder, findAdjacentTaskIds } from "@/lib/findAdjacentTaskIds";

const rows = [
  { id: "newest", created_at: "2026-08-14T09:00:00.000Z" },
  { id: "mid", created_at: "2026-08-13T09:00:00.000Z" },
  { id: "oldest", created_at: "2026-08-12T09:00:00.000Z" },
];

describe("findAdjacentTaskIds", () => {
  it("returns newer as prev and older as next", () => {
    expect(findAdjacentTaskIds(rows, "mid")).toEqual({
      prevId: "newest",
      nextId: "oldest",
    });
  });

  it("hides prev on the newest task", () => {
    expect(findAdjacentTaskIds(rows, "newest")).toEqual({
      prevId: null,
      nextId: "mid",
    });
  });

  it("hides next on the oldest task", () => {
    expect(findAdjacentTaskIds(rows, "oldest")).toEqual({
      prevId: "mid",
      nextId: null,
    });
  });

  it("returns nulls when the current task is not in the list", () => {
    expect(findAdjacentTaskIds(rows, "missing")).toEqual({
      prevId: null,
      nextId: null,
    });
  });
});

describe("findAdjacentIdsInOrder", () => {
  it("follows list order without re-sorting", () => {
    expect(findAdjacentIdsInOrder(["a", "b", "c"], "b")).toEqual({
      prevId: "a",
      nextId: "c",
    });
  });

  it("hides prev on the first item", () => {
    expect(findAdjacentIdsInOrder(["a", "b"], "a")).toEqual({
      prevId: null,
      nextId: "b",
    });
  });
});
