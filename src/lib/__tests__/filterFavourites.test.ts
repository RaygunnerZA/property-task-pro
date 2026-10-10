import { afterEach, describe, expect, it, vi } from "vitest";
import {
  insertFavourite,
  insertionIndex,
  readStoredFavourites,
  removeFavourite,
  writeStoredFavourites,
  type FilterFavourite,
} from "@/lib/filterFavourites";

const memory = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => {
    memory.clear();
  },
});

const status: FilterFavourite = { kind: "option", id: "filter-status-todo" };
const due: FilterFavourite = { kind: "option", id: "filter-date-today" };
const category: FilterFavourite = { kind: "category", id: "status" };

describe("filter favourites", () => {
  afterEach(() => {
    memory.clear();
  });

  it("inserts an alias without dropping the earlier chips", () => {
    expect(insertFavourite([status], due, 0)).toEqual([due, status]);
    expect(insertFavourite([status, due], category, 1)).toEqual([status, category, due]);
  });

  it("moves a chip that is already a favourite instead of duplicating it", () => {
    expect(insertFavourite([status, due, category], status, 2)).toEqual([due, category, status]);
  });

  it("removes only the dropped favourite", () => {
    expect(removeFavourite([status, due], status)).toEqual([due]);
  });

  it("reads the drop index from chip midpoints", () => {
    expect(insertionIndex([20, 60, 100], 10)).toBe(0);
    expect(insertionIndex([20, 60, 100], 61)).toBe(2);
    expect(insertionIndex([20, 60, 100], 140)).toBe(3);
  });

  it("round-trips a saved arrangement and ignores a bad payload", () => {
    expect(readStoredFavourites("tasks")).toBeNull();
    writeStoredFavourites("tasks", [due, category]);
    expect(readStoredFavourites("tasks")).toEqual([due, category]);
    localStorage.setItem("filla.filter-favourites.v1.tasks", "{");
    expect(readStoredFavourites("tasks")).toBeNull();
  });
});
