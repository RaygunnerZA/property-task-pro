import { describe, expect, it } from "vitest";
import { knowledgeStatusUserLabel } from "@/lib/knowledge/knowledgeStatusLabel";

describe("knowledgeStatusUserLabel", () => {
  it("maps lifecycle statuses to Ch30 user labels", () => {
    expect(knowledgeStatusUserLabel("candidate")).toBe("Needs Review");
    expect(knowledgeStatusUserLabel("verified")).toBe("Verified");
    expect(knowledgeStatusUserLabel("published")).toBe("Published");
    expect(knowledgeStatusUserLabel("stale")).toBe("Stale");
    expect(knowledgeStatusUserLabel("archived")).toBe("Archived");
  });
});
