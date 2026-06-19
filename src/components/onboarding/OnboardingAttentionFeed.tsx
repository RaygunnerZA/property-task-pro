import type { MutableRefObject } from "react";
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
};

function ExampleSectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        <span className="rounded-md bg-[#8EC9CE]/15 px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-[#5a9ea3]">
          Example
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
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
}: OnboardingAttentionFeedProps) {
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

  const needsAttention = [...ONBOARDING_NEEDS_ATTENTION, ...reviewItems].slice(0, 4);
  const signals = [...ONBOARDING_SIGNALS, ...recentItems].slice(0, 5);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section className="space-y-2">
        <ExampleSectionHeader
          title="Quick wins"
          subtitle="Actions you can complete in under a minute."
        />
        <IssuesScrollColumn
          title=""
          subtitle=""
          countVariant="recent"
          items={ONBOARDING_QUICK_WINS}
          totalCount={countAttentionSectionItems(ONBOARDING_QUICK_WINS)}
          renderCard={renderSignal}
          layout="vertical"
          hideHeader
        />
      </section>

      <section className="space-y-2">
        <ExampleSectionHeader
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

      <section className="space-y-2">
        <ExampleSectionHeader
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

      <section className="space-y-2">
        <ExampleSectionHeader
          title="Records to organise"
          subtitle="Documents Filla can categorise and monitor."
        />
        <IssuesScrollColumn
          title=""
          subtitle=""
          countVariant="review"
          items={ONBOARDING_RECORDS}
          totalCount={ONBOARDING_RECORDS.length}
          renderCard={renderSignal}
          layout="vertical"
          hideHeader
        />
      </section>
    </div>
  );
}
