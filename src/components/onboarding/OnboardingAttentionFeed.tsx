import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import { Check } from "lucide-react";
import { IssuesScrollColumn } from "@/components/dashboard/issues/IssuesScrollColumn";
import { IssuesSignalCard } from "@/components/dashboard/issues/IssuesSignalCard";
import type { AttentionItem } from "@/components/dashboard/issues/issuesAttentionItem";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";
import { countAttentionSectionItems } from "@/lib/issuesSignalOrdering";
import type { IntakeMode } from "@/types/intake";
import {
  ONBOARDING_NEEDS_ATTENTION,
  ONBOARDING_QUICK_WINS,
  ONBOARDING_RECORDS,
  ONBOARDING_SIGNALS,
} from "@/fixtures/onboardingAttentionSamples";
import { workbenchSectionTitleClassName } from "@/lib/workbenchSectionTitle";
import { useQuickWins } from "@/hooks/useQuickWins";
import { QUICK_WINS_ALL_DONE_COPY, quickWinIdFromAttentionId } from "@/lib/quickWins";
import {
  dismissOnboardingSample,
  isOnboardingSampleNotification,
  ONBOARDING_SAMPLE_DISMISSED_EVENT,
  readDismissedOnboardingSampleIds,
} from "@/lib/onboardingEducation";

export type OnboardingAttentionFeedProps = {
  attentionCardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  resolveAttentionItem: (id: string) => void;
  handleSignalAction?: (actionId: string, item: AttentionItem) => Promise<boolean>;
  addAttentionItemToCompliance: (item: AttentionItem) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
  onMessageClick?: (messageId: string) => void;
  onAttentionItemSelect?: (payload: WorkbenchAttentionSelectPayload) => void;
  reviewItems?: AttentionItem[];
  recentItems?: AttentionItem[];
  propertyId?: string | null;
};

function FeedSectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-0.5">
      <h2 className={workbenchSectionTitleClassName}>{title}</h2>
      <p className="mt-0.5 text-base text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export function OnboardingAttentionFeed({
  attentionCardRefs,
  resolveAttentionItem,
  handleSignalAction,
  addAttentionItemToCompliance,
  onOpenIntake,
  onMessageClick,
  onAttentionItemSelect,
  reviewItems = [],
  recentItems = [],
  propertyId = null,
}: OnboardingAttentionFeedProps) {
  const { allDone, isComplete } = useQuickWins(propertyId);
  const [dismissedSamples, setDismissedSamples] = useState(() =>
    propertyId ? readDismissedOnboardingSampleIds(propertyId) : new Set<string>()
  );

  useEffect(() => {
    setDismissedSamples(propertyId ? readDismissedOnboardingSampleIds(propertyId) : new Set());
  }, [propertyId]);

  useEffect(() => {
    const sync = () => {
      setDismissedSamples(propertyId ? readDismissedOnboardingSampleIds(propertyId) : new Set());
    };
    window.addEventListener(ONBOARDING_SAMPLE_DISMISSED_EVENT, sync);
    return () => window.removeEventListener(ONBOARDING_SAMPLE_DISMISSED_EVENT, sync);
  }, [propertyId]);

  const resolveItem = useCallback(
    (id: string) => {
      if (isOnboardingSampleNotification({ id })) {
        if (propertyId) {
          setDismissedSamples(dismissOnboardingSample(propertyId, id));
        } else {
          setDismissedSamples((prev) => new Set([...prev, id]));
        }
      }
      resolveAttentionItem(id);
    },
    [propertyId, resolveAttentionItem]
  );

  const quickWins = ONBOARDING_QUICK_WINS.filter((item) => {
    const id = quickWinIdFromAttentionId(item.id);
    return !id || !isComplete(id);
  });
  const renderSignal = (item: AttentionItem) => (
    <IssuesSignalCard
      item={item}
      attentionCardRefs={attentionCardRefs}
      resolveAttentionItem={resolveItem}
      handleSignalAction={handleSignalAction}
      addAttentionItemToCompliance={addAttentionItemToCompliance}
      onOpenIntake={onOpenIntake}
      onMessageClick={onMessageClick}
      onAttentionItemSelect={onAttentionItemSelect}
    />
  );

  const sampleNeeds = ONBOARDING_NEEDS_ATTENTION.filter((item) => !dismissedSamples.has(item.id));
  const sampleSignals = ONBOARDING_SIGNALS.filter((item) => !dismissedSamples.has(item.id));
  const sampleRecords = ONBOARDING_RECORDS.filter((item) => !dismissedSamples.has(item.id));
  const needsAttention = [...sampleNeeds, ...reviewItems].slice(0, 4);
  const signals = [...sampleSignals, ...recentItems].slice(0, 5);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="space-y-2">
        <FeedSectionHeader
          title="Quick wins"
          subtitle={
            allDone
              ? QUICK_WINS_ALL_DONE_COPY.description
              : "Setup steps you can complete in under a minute."
          }
        />
        {allDone ? (
          <div className="flex items-center gap-2 rounded-card bg-card/80 px-3 py-2.5 shadow-md">
            <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <p className="text-sm font-medium text-foreground">{QUICK_WINS_ALL_DONE_COPY.title}</p>
          </div>
        ) : (
          <IssuesScrollColumn
            title=""
            subtitle=""
            countVariant="recent"
            items={quickWins}
            totalCount={countAttentionSectionItems(quickWins)}
            renderCard={renderSignal}
            layout="flex-columns"
            hideHeader
          />
        )}
      </section>

      {needsAttention.length > 0 ? (
        <section className="space-y-2">
          <FeedSectionHeader
            title="Needs attention"
            subtitle="Compliance, maintenance, and items needing a decision."
          />
          <IssuesScrollColumn
            title=""
            subtitle=""
            countVariant="review"
            items={needsAttention}
            totalCount={needsAttention.length}
            renderCard={renderSignal}
            layout="vertical"
            hideHeader
          />
        </section>
      ) : null}

      {signals.length > 0 ? (
        <section className="space-y-2">
          <FeedSectionHeader
            title="Signals Filla found"
            subtitle="How AI surfaces updates and risks across your property."
          />
          <IssuesScrollColumn
            title=""
            subtitle=""
            countVariant="recent"
            items={signals}
            totalCount={signals.length}
            renderCard={renderSignal}
            layout="vertical"
            hideHeader
          />
        </section>
      ) : null}

      {sampleRecords.length > 0 ? (
        <section className="space-y-2">
          <FeedSectionHeader
            title="Records to organise"
            subtitle="Documents Filla can categorise and monitor."
          />
          <IssuesScrollColumn
            title=""
            subtitle=""
            countVariant="review"
            items={sampleRecords}
            totalCount={sampleRecords.length}
            renderCard={renderSignal}
            layout="vertical"
            hideHeader
          />
        </section>
      ) : null}
    </div>
  );
}
