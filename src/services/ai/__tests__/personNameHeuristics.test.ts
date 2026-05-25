import { describe, it, expect } from "vitest";
import { isMonthInDateContext, isRejectedPersonName } from "../personNameHeuristics";

describe("personNameHeuristics", () => {
  it("rejects imperative verbs", () => {
    expect(isRejectedPersonName("Have")).toBe(true);
    expect(isRejectedPersonName("Collect")).toBe(true);
  });

  it("rejects month names in date phrases", () => {
    const text = "before the 12th June.";
    expect(isMonthInDateContext("June", text)).toBe(true);
    expect(isRejectedPersonName("June", text)).toBe(true);
  });

  it("allows real names", () => {
    expect(isRejectedPersonName("Oliver")).toBe(false);
    expect(isRejectedPersonName("Frank")).toBe(false);
  });
});
