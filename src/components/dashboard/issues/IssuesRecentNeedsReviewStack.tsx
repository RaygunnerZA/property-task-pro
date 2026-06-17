import { useMemo } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { IssuesScrollColumn } from "@/components/dashboard/issues/IssuesScrollColumn";
import { IssuesSignalCard } from "@/components/dashboard/issues/IssuesSignalCard";
import type { AttentionItem } from "@/components/dashboard/issues/issuesAttentionItem";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";
import { pickTopRecentSignals, pickTopReviewSignals, countAttentionSectionItems } from "@/lib/issuesSignalOrdering";
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

/** Home Attention centre — same rows, shorter section label. */
export const ATTENTION_SIGNALS_SECTION = {
  title: "Signals",
  subtitle: "New updates and information detected across the system",
  emptyTitle: "No new signals",
  emptyDescription: "When messages, uploads, or environmental scans arrive, they appear here.",
} as const;

export type IssuesRecentNeedsReviewStackProps = {
  recentItems: AttentionItem[];
  reviewItems: AttentionItem[];
  attentionCardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  resolveAttentionItem: (id: string) => void;
  handleSignalAction?: (actionId: string, item: AttentionItem) => Promise<boolean>;
  addAttentionItemToCompliance: (item: AttentionItem) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
  onMessageClick?: (messageId: string) => void;
  onAttentionItemSelect?: (payload: WorkbenchAttentionSelectPayload) => void;
  layout?: "vertical" | "horizontal";
  onViewAllIssues?: () => void;
  /** Override default “Recent signals” section copy (e.g. Home Attention centre). */
  signalsSection?: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyDescription: string;
  };
  /** Rendered between Needs review and Signals (e.g. Home Open work). */
  middleSlot?: ReactNode;
};

/**
 * Stacked Needs review + Recent sections — one signal per row in each list.
 */
export function IssuesRecentNeedsReviewStack({
  recentItems,
  reviewItems,
  attentionCardRefs,
  resolveAttentionItem,
  handleSignalAction,
  addAttentionItemToCompliance,
  onOpenIntake,
  onMessageClick,
  onAttentionItemSelect,
  layout = "vertical",
  onViewAllIssues,
  signalsSection = ISSUES_RECENT_SIGNALS_SECTION,
  middleSlot,
}: IssuesRecentNeedsReviewStackProps) {
  const displayReviewItems = useMemo(() => pickTopReviewSignals(reviewItems), [reviewItems]);
  const displayRecentItems = useMemo(() => pickTopRecentSignals(recentItems), [recentItems]);

  const renderSignal = (item: AttentionItem) => (
    <IssuesSignalCard
      item={item}
      attentionCardRefs={attentionCardRefs}
      resolveAttentionItem={resolveAttentionItem}
      handleSignalAction={handleSignalAction}
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
        totalCount={countAttentionSectionItems(reviewItems)}
        emptyTitle={ISSUES_NEEDS_REVIEW_SECTION.emptyTitle}
        emptyDescription={ISSUES_NEEDS_REVIEW_SECTION.emptyDescription}
        renderCard={renderSignal}
        layout={layout}
        onViewAll={onViewAllIssues}
      />
      {middleSlot}
      <IssuesScrollColumn
        title={signalsSection.title}
        subtitle={signalsSection.subtitle}
        countVariant="recent"
        items={displayRecentItems}
        totalCount={countAttentionSectionItems(recentItems)}
        emptyTitle={signalsSection.emptyTitle}
        emptyDescription={signalsSection.emptyDescription}
        renderCard={renderSignal}
        layout={layout}
        onViewAll={onViewAllIssues}
      />
    </div>
  );
}
