import { describe, expect, it } from "vitest";
import {
  parseChecklistTemplateItems,
  serializeChecklistTemplateItems,
} from "@/lib/checklistTemplateItems";

describe("checklistTemplateItems", () => {
  it("persists response types and indent when serializing", () => {
    const items = serializeChecklistTemplateItems([
      {
        title: "SECTION",
        is_yes_no: false,
        requires_signature: false,
        step_type: "title",
      },
      {
        title: "Water plants?",
        is_yes_no: false,
        requires_signature: false,
        step_type: "yes_no",
        is_sub_step: true,
        is_required: true,
      },
      {
        title: "Prove it",
        is_yes_no: false,
        requires_signature: false,
        step_type: "photo",
      },
      {
        title: "Sign off",
        is_yes_no: false,
        requires_signature: false,
        step_type: "signature",
      },
    ]);

    expect(items).toEqual([
      {
        title: "SECTION",
        step_type: "title",
        is_sub_step: false,
        is_required: false,
        is_yes_no: false,
        requires_signature: false,
      },
      {
        title: "Water plants?",
        step_type: "yes_no",
        is_sub_step: true,
        is_required: true,
        is_yes_no: true,
        requires_signature: false,
      },
      {
        title: "Prove it",
        step_type: "photo",
        is_sub_step: false,
        is_required: false,
        is_yes_no: false,
        requires_signature: false,
      },
      {
        title: "Sign off",
        step_type: "signature",
        is_sub_step: false,
        is_required: false,
        is_yes_no: false,
        requires_signature: true,
      },
    ]);
  });

  it("restores step types from legacy flags when step_type is missing", () => {
    const parsed = parseChecklistTemplateItems([
      { title: "Yes?", is_yes_no: true, requires_signature: false },
      { title: "Sign", is_yes_no: false, requires_signature: true },
      { title: "Photo", step_type: "photo", is_yes_no: false, requires_signature: false },
    ]);

    expect(parsed.map((p) => p.step_type)).toEqual(["yes_no", "signature", "photo"]);
    expect(parsed.map((p) => p.is_yes_no)).toEqual([true, false, false]);
    expect(parsed.map((p) => p.requires_signature)).toEqual([false, true, false]);
  });

  it("does not let a hardcoded check step_type win over missing rich types on legacy rows", () => {
    // Regression: importers used to force step_type: "check", which hid yes/no + signature.
    const parsed = parseChecklistTemplateItems([
      { title: "Did you water?", is_yes_no: true, requires_signature: false },
    ]);
    expect(parsed[0]?.step_type).toBe("yes_no");
  });
});
