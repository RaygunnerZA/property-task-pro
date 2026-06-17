import { describe, expect, it } from "vitest";
import {
  isPropertySubsetSelected,
  recordMatchesPropertyScope,
  taskMatchesPropertyScope,
} from "@/utils/propertyFilter";

const ALL = ["p1", "p2", "p3"];

describe("property scope helpers", () => {
  it("treats full selection as not a subset filter", () => {
    expect(isPropertySubsetSelected(new Set(ALL), ALL)).toBe(false);
    expect(isPropertySubsetSelected(undefined, ALL)).toBe(false);
  });

  it("treats single and multi selection as subset filter", () => {
    expect(isPropertySubsetSelected(new Set(["p1"]), ALL)).toBe(true);
    expect(isPropertySubsetSelected(new Set(["p1", "p2"]), ALL)).toBe(true);
  });

  it("filters tasks and compliance rows by scoped properties", () => {
    const subset = new Set(["p2"]);
    expect(taskMatchesPropertyScope({ property_id: "p1" }, subset, ALL)).toBe(false);
    expect(taskMatchesPropertyScope({ property_id: "p2" }, subset, ALL)).toBe(true);
    expect(taskMatchesPropertyScope({ property_id: "p1" }, new Set(ALL), ALL)).toBe(true);

    expect(recordMatchesPropertyScope("p1", subset, ALL)).toBe(false);
    expect(recordMatchesPropertyScope(null, subset, ALL)).toBe(false);
    expect(recordMatchesPropertyScope("p2", subset, ALL)).toBe(true);
  });
});
