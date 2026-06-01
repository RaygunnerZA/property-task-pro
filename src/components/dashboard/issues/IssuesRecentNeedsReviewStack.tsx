import { useMemo } from "react";
import type { MutableRefObject } from "react";
import { IssuesScrollColumn } from "@/components/dashboard/issues/IssuesScrollColumn";
import { IssuesSignalCard } from "@/components/dashboard/issues/IssuesSignalCard";
import type { AttentionItem } from "@/components/dashboard/issues/issuesAttentionItem";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";
import { pickTopRecentSignals, pickTopReviewSignals } from "@/lib/issuesSignalOrdering";
import type { IntakeMode } from "@/types/intake";

/** Needs review queue — row cards via IssuesReviewSignalRow (through OperationalStreamCard). */
export const ISSUES_NEEDS_REVIEW_SECTION = {
  title: "Needs review",
  subtitle: "Items that need your judgement",
  emptyTitle: "Nothing in the decision queue",
  emptyDescription: "When Filla needs your judgement before routing work, items appear here.",
} as const;

/** Recent signals timeline — row cards via IssuesRecentSignalRow. */
export const ISSUES_RECENT_SIGNALS_SECTION = {
  title: "Recent signals",
  subtitle: "What just entered the system",
  emptyTitle: "Nothing new in the timeline",
  emptyDescription: "When photos, messages, or uploads arrive, they show up here first.",
} as const;

export type IssuesRecentNeedsReviewStackProps = {
  recentItems: AttentionItem[];
  reviewItems: AttentionItem[];
  attentionCardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  resolveAttentionItem: (id: string) => void;
  addAttentionItemToCompliance: (item: AttentionItem) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
  onMessageClick?: (messageId: string) => void;
  onAttentionItemSelect?: (payload: WorkbenchAttentionSelectPayload) => void;
};

/**
 * Stacked Needs review + Recent sections using horizontal row formatting in each list.
 */
export function IssuesRecentNeedsReviewStack({
  recentItems,
  reviewItems,
  attentionCardRefs,
  resolveAttentionItem,
  addAttentionItemToCompliance,
  onOpenIntake,
  onMessageClick,
  onAttentionItemSelect,
}: IssuesRecentNeedsReviewStackProps) {
  const displayReviewItems = useMemo(() => pickTopReviewSignals(reviewItems), [reviewItems]);
  const displayRecentItems = useMemo(() => pickTopRecentSignals(recentItems), [recentItems]);

  const renderSignal = (item: AttentionItem) => (
    <IssuesSignalCard
      item={item}
      attentionCardRefs={attentionCardRefs}
      resolveAttentionItem={resolveAttentionItem}
      addAttentionItemToCompliance={addAttentionItemToCompliance}
      onOpenIntake={onOpenIntake}
      onMessageClick={onMessageClick}
      onAttentionItemSelect={onAttentionItemSelect}
    />
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <IssuesScrollColumn
        title={ISSUES_NEEDS_REVIEW_SECTION.title}
        subtitle={ISSUES_NEEDS_REVIEW_SECTION.subtitle}
        countVariant="review"
        items={displayReviewItems}
        totalCount={reviewItems.length}
        emptyTitle={ISSUES_NEEDS_REVIEW_SECTION.emptyTitle}
        emptyDescription={ISSUES_NEEDS_REVIEW_SECTION.emptyDescription}
        renderCard={renderSignal}
      />
      <IssuesScrollColumn
        title={ISSUES_RECENT_SIGNALS_SECTION.title}
        subtitle={ISSUES_RECENT_SIGNALS_SECTION.subtitle}
        countVariant="recent"
        items={displayRecentItems}
        totalCount={recentItems.length}
        emptyTitle={ISSUES_RECENT_SIGNALS_SECTION.emptyTitle}
        emptyDescription={ISSUES_RECENT_SIGNALS_SECTION.emptyDescription}
        renderCard={renderSignal}
      />
    </div>
  );
}
