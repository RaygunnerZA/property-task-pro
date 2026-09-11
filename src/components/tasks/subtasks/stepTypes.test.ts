import { describe, expect, it } from "vitest";
import { showsExecuteCheckbox, isStructureStepType, STEP_TYPES_ORDERED } from "./stepTypes";

describe("showsExecuteCheckbox", () => {
  it("is only true for plain check steps", () => {
    expect(showsExecuteCheckbox("check")).toBe(true);
    for (const type of STEP_TYPES_ORDERED) {
      if (type === "check") continue;
      expect(showsExecuteCheckbox(type)).toBe(false);
    }
    expect(showsExecuteCheckbox("signature")).toBe(false);
    expect(showsExecuteCheckbox("title")).toBe(false);
  });
});

describe("isStructureStepType", () => {
  it("marks title, note, and divider as structure-only", () => {
    expect(isStructureStepType("title")).toBe(true);
    expect(isStructureStepType("note")).toBe(true);
    expect(isStructureStepType("divider")).toBe(true);
    expect(isStructureStepType("check")).toBe(false);
    expect(isStructureStepType("signature")).toBe(false);
  });
});
