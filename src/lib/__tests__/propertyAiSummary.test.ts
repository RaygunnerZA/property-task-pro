import { describe, expect, it } from "vitest";
import {
  briefTaskSubject,
  getAllPropertiesSummaryLines,
  getPropertyAiSummaryLines,
} from "@/lib/propertyAiSummary";

describe("briefTaskSubject", () => {
  it("strips log-style prefixes and trailing status clauses", () => {
    expect(
      briefTaskSubject("Accidentally deleted asset - fire extinguisher needs attention.")
    ).toBe("fire extinguisher");
  });

  it("keeps a normal task title", () => {
    expect(briefTaskSubject("Review Fire Extinguisher Certificate")).toBe(
      "Review Fire Extinguisher Certificate"
    );
  });
});

describe("getPropertyAiSummaryLines", () => {
  it("does not paste a raw task title next to the Filla prompt", () => {
    const lines = getPropertyAiSummaryLines(
      [
        {
          id: "t1",
          status: "open",
          priority: "urgent",
          title: "Accidentally deleted asset - fire extinguisher needs attention.",
        },
      ],
      []
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe("Open this next: the fire extinguisher.");
    expect(lines[0]?.text.toLowerCase()).not.toContain("accidentally deleted");
    expect(lines[0]?.text.toLowerCase()).not.toMatch(/needs attention/);
    expect(lines[0]?.target).toEqual({ type: "task", taskId: "t1" });
  });

  it("summarises several urgent tasks instead of listing the first title", () => {
    const lines = getPropertyAiSummaryLines(
      [
        {
          id: "t1",
          status: "open",
          priority: "high",
          title: "Paint the stairwell",
        },
        {
          id: "t2",
          status: "open",
          priority: "urgent",
          title: "Boiler Service Due Soon",
        },
      ],
      []
    );

    expect(lines[0]?.text).toBe("2 urgent tasks are open. Start with Boiler Service Due Soon.");
    expect(lines[0]?.target).toEqual({ type: "task", taskId: "t2" });
  });
});

describe("getAllPropertiesSummaryLines", () => {
  it("uses the same next-action voice for portfolio urgent work", () => {
    const lines = getAllPropertiesSummaryLines(
      [
        {
          id: "t1",
          status: "open",
          priority: "urgent",
          title: "Accidentally deleted asset - fire extinguisher needs attention.",
        },
      ],
      1
    );
    expect(lines[0]?.text).toBe("Open this next: the fire extinguisher.");
  });
});
