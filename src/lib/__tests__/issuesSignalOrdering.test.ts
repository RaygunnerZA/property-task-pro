import { describe, expect, it } from "vitest";
import {
  ISSUES_SIGNAL_PREVIEW_LIMIT,
  pickTopRecentSignals,
  pickTopReviewSignals,
  rankReviewImportance,
} from "@/lib/issuesSignalOrdering";

describe("issuesSignalOrdering", () => {
  it("ranks low confidence and missing compliance ahead of medium review items", () => {
    expect(
      rankReviewImportance({ id: "fixture:review:ai_classify", confidenceLevel: "low" })
    ).toBeLessThan(
      rankReviewImportance({ id: "fixture:review:conflict", confidenceLevel: "medium" })
    );
    expect(
      rankReviewImportance({
        id: "review-rec-1",
        confidenceLevel: "medium",
        complianceSeed: {},
        whyHere: "Not sure this belongs in compliance tracking yet.",
      })
    ).toBeLessThan(
      rankReviewImportance({ id: "fixture:review:admin", confidenceLevel: "medium" })
    );
  });

  it("returns at most three review items sorted by importance", () => {
    const items = [
      { id: "a", confidenceLevel: "high" as const },
      { id: "b", confidenceLevel: "low" as const },
      { id: "c", confidenceLevel: "medium" as const },
      { id: "d", confidenceLevel: "medium" as const },
    ];
    expect(pickTopReviewSignals(items).map((i) => i.id)).toEqual(["b", "c", "d"]);
    expect(pickTopReviewSignals(items)).toHaveLength(ISSUES_SIGNAL_PREVIEW_LIMIT);
  });

  it("returns the three most recent signals by occurredAt", () => {
    const items = [
      { id: "old", occurredAt: 1 },
      { id: "mid", occurredAt: 2 },
      { id: "new", occurredAt: 3 },
      { id: "newest", occurredAt: 4 },
    ];
    expect(pickTopRecentSignals(items).map((i) => i.id)).toEqual(["newest", "new", "mid"]);
  });

  it("preserves the empty-state seed row", () => {
    const seed = [{ id: "recent-empty-seed" }];
    expect(pickTopRecentSignals(seed)).toEqual(seed);
  });
});
