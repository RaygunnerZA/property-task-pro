import type { SignalConfidenceLevel } from "@/components/dashboard/issues/IssuesSignalListParts";

export const ISSUES_SIGNAL_PREVIEW_LIMIT = 3;

const ATTENTION_EMPTY_SEED_ID = "recent-empty-seed";

/** Count attention rows for section badges (excludes global empty-state placeholder). */
export function countAttentionSectionItems<T extends { id: string }>(items: T[]): number {
  return items.filter((item) => item.id !== ATTENTION_EMPTY_SEED_ID).length;
}

const CONFIDENCE_IMPORTANCE: Record<SignalConfidenceLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export type IssuesSignalOrderable = {
  id: string;
  confidenceLevel?: SignalConfidenceLevel;
  whyHere?: string;
  complianceSeed?: unknown;
  occurredAt?: number;
};

/** Lower rank = higher priority in the Needs review queue. */
export function rankReviewImportance(item: IssuesSignalOrderable): number {
  let rank = CONFIDENCE_IMPORTANCE[item.confidenceLevel ?? "medium"];

  if (item.id.startsWith("review-")) {
    if (item.complianceSeed && item.whyHere?.startsWith("Not sure")) {
      rank = Math.min(rank, -1);
    } else if (item.whyHere?.includes("Expiry")) {
      rank = Math.min(rank, 0.5);
    }
  }

  return rank;
}

export function pickTopReviewSignals<T extends IssuesSignalOrderable>(items: T[]): T[] {
  return [...items]
    .sort((a, b) => rankReviewImportance(a) - rankReviewImportance(b))
    .slice(0, ISSUES_SIGNAL_PREVIEW_LIMIT);
}

export function pickTopRecentSignals<T extends IssuesSignalOrderable>(items: T[]): T[] {
  if (items.length === 1 && items[0]?.id === "recent-empty-seed") {
    return items;
  }

  return [...items]
    .sort((a, b) => (b.occurredAt ?? 0) - (a.occurredAt ?? 0))
    .slice(0, ISSUES_SIGNAL_PREVIEW_LIMIT);
}
