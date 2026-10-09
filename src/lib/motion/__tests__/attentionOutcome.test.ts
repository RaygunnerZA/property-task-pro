import { describe, expect, it } from "vitest";
import { attentionOutcomeFromAction } from "@/lib/motion/attentionOutcome";

describe("attentionOutcomeFromAction", () => {
  it("sends accepted recommendations to Tasks", () => {
    expect(attentionOutcomeFromAction("signal-accept")).toBe("task");
  });

  it("files a compliance conversion", () => {
    expect(attentionOutcomeFromAction("signal-convert")).toBe("filed");
  });

  it("sends promoted mail to Knowledge review", () => {
    expect(attentionOutcomeFromAction("signal-promote-intake")).toBe("knowledge");
  });

  it("fails closed to dismissed", () => {
    expect(attentionOutcomeFromAction("dismiss")).toBe("dismissed");
    expect(attentionOutcomeFromAction("unknown")).toBe("dismissed");
  });
});
