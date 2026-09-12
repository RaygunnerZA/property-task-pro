import { describe, expect, it } from "vitest";
import {
  showsExecuteCheckbox,
  executeCheckboxCompletesStep,
  isStructureStepType,
  STEP_TYPES_ORDERED,
} from "./stepTypes";

describe("showsExecuteCheckbox", () => {
  it("is true for all interactive step types (alignment slot)", () => {
    for (const type of STEP_TYPES_ORDERED) {
      expect(showsExecuteCheckbox(type)).toBe(true);
    }
    expect(showsExecuteCheckbox("signature")).toBe(true);
    expect(showsExecuteCheckbox("title")).toBe(false);
    expect(showsExecuteCheckbox("note")).toBe(false);
    expect(showsExecuteCheckbox("divider")).toBe(false);
  });
});

describe("executeCheckboxCompletesStep", () => {
  it("is only true for plain check steps", () => {
    expect(executeCheckboxCompletesStep("check")).toBe(true);
    for (const type of STEP_TYPES_ORDERED) {
      if (type === "check") continue;
      expect(executeCheckboxCompletesStep(type)).toBe(false);
    }
    expect(executeCheckboxCompletesStep("yes_no")).toBe(false);
    expect(executeCheckboxCompletesStep("title")).toBe(false);
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
