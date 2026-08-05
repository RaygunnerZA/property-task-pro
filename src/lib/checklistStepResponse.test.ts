import { describe, expect, it } from "vitest";
import {
  isStepResponseComplete,
  responseLabelForType,
} from "@/lib/checklistStepResponse";

describe("checklistStepResponse", () => {
  it("labels yes/no and pass/fail answers", () => {
    expect(responseLabelForType("yes_no", "yes")).toBe("Yes");
    expect(responseLabelForType("pass_fail", "fail")).toBe("Fail");
    expect(responseLabelForType("number", "7.2")).toBe("7.2");
  });

  it("treats photo steps complete when attachment exists", () => {
    expect(
      isStepResponseComplete("photo", {
        response_attachment_id: "att-1",
        is_completed: true,
        completed: true,
        response_value: "photo",
        response_json: {},
        completed_by: null,
        completed_at: null,
        signed_by: null,
        signed_at: null,
      })
    ).toBe(true);
  });

  it("requires a value for number/text/scan", () => {
    expect(isStepResponseComplete("number", { response_value: null, is_completed: true })).toBe(
      false
    );
    expect(isStepResponseComplete("number", { response_value: "12", is_completed: true })).toBe(
      true
    );
  });
});
