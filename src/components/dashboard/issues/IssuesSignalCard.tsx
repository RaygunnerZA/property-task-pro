import type { MutableRefObject } from "react";
import { AlertTriangle, HelpCircle, Upload } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { OperationalStreamCard } from "@/components/dashboard/OperationalStreamCard";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";
import {
  attentionItemToSignalSnapshot,
  type AttentionItem,
} from "@/components/dashboard/issues/issuesAttentionItem";
import { formatRecentSignalSubtitle, signalCategoryForKind } from "@/lib/signalDisplayMeta";
import { performOnboardingFixtureAction } from "@/lib/onboardingFixtureActions";
import {
  dismissOnboardingSample,
  isOnboardingSampleNotification,
  ONBOARDING_SAMPLE_LABEL,
} from "@/lib/onboardingEducation";
import { quickWinIdFromAttentionId } from "@/lib/quickWins";
import { resolveAttentionStreamThumbnail } from "@/lib/taskIllustration";
import { signalKindIcon } from "@/lib/signalKindIcons";
import type { IntakeMode } from "@/types/intake";

export type IssuesSignalCardProps = {
  item: AttentionItem;
  attentionCardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  resolveAttentionItem: (id: string) => void;
  handleSignalAction?: (actionId: string, item: AttentionItem) => Promise<boolean>;
  addAttentionItemToCompliance: (item: AttentionItem) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
  onMessageClick?: (messageId: string) => void;
  onAttentionItemSelect?: (payload: WorkbenchAttentionSelectPayload) => void;
};

function runFixtureAction(
  actionId: string,
  item: AttentionItem,
  ctx: {
    resolveAttentionItem: (id: string) => void;
    handleSignalAction?: (actionId: string, item: AttentionItem) => Promise<boolean>;
    addAttentionItemToCompliance: (item: AttentionItem) => void;
    onOpenIntake?: (mode: IntakeMode) => void;
    onMessageClick?: (messageId: string) => void;
    navigate: (to: string) => void;
    propertyId: string | null;
  }
) {
  const {
    resolveAttentionItem,
    handleSignalAction,
    addAttentionItemToCompliance,
    onOpenIntake,
    onMessageClick,
    navigate,
    propertyId,
  } = ctx;

  if (item.signalId && handleSignalAction) {
    void handleSignalAction(actionId, item).then((handled) => {
      if (handled) return;
      // fall through for unhandled actions
    });
    if (
      ["signal-accept", "signal-snooze", "dismiss", "ignore", "signal-promote-intake"].includes(
        actionId
      )
    ) {
      return;
    }
  }

  if (actionId === "signal-open") {
    if (item.messageId) onMessageClick?.(item.messageId);
    resolveAttentionItem(item.id);
    return;
  }

  if (actionId === "signal-convert" && item.complianceSeed) {
    addAttentionItemToCompliance(item);
    resolveAttentionItem(item.id);
    return;
  }

  if (
    (actionId === "delete-sample" || actionId === "dismiss") &&
    isOnboardingSampleNotification(item)
  ) {
    if (propertyId) dismissOnboardingSample(propertyId, item.id);
    resolveAttentionItem(item.id);
    return;
  }

  performOnboardingFixtureAction(actionId, { navigate, propertyId, onOpenIntake });
  // Quick wins stay visible until the real action completes (save / upload / create).
  if (!quickWinIdFromAttentionId(item.id)) {
    resolveAttentionItem(item.id);
  }
}

/**
 * Signal row in Issues triage — delegates review/recent to row cards via OperationalStreamCard.
 */
export function IssuesSignalCard({
  item,
  attentionCardRefs,
  resolveAttentionItem,
  handleSignalAction,
  addAttentionItemToCompliance,
  onOpenIntake,
  onMessageClick,
  onAttentionItemSelect,
}: IssuesSignalCardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyId = searchParams.get("property");

  const ctx = {
    resolveAttentionItem,
    handleSignalAction,
    addAttentionItemToCompliance,
    onOpenIntake,
    onMessageClick,
    navigate,
    propertyId,
  };

  const cardActivate =
    item.id === "recent-empty-seed" || !onAttentionItemSelect
      ? undefined
      : () => {
          if (item.messageId) {
            onAttentionItemSelect({ kind: "message", messageId: item.messageId });
          } else {
            onAttentionItemSelect({
              kind: "signal",
              snapshot: attentionItemToSignalSnapshot(item),
            });
          }
        };

  const thumbnailUrl = resolveAttentionStreamThumbnail({
    imageUrl: item.imageUrl,
    title: item.title,
    context: item.context,
    signalKind: item.signalKind,
  });

  if (item.group === "urgent") {
    const icon = item.signalKind
      ? signalKindIcon(item.signalKind, "text-warning-foreground")
      : <AlertTriangle className="h-4 w-4 text-warning-foreground" />;
    const actionsList =
      item.fixtureActions != null
        ? [
            {
              id: item.fixtureActions.primary.id,
              label: item.fixtureActions.primary.label,
              onClick: () => runFixtureAction(item.fixtureActions!.primary.id, item, ctx),
            },
            ...(item.fixtureActions.secondary ?? []).map((a) => ({
              id: a.id,
              label: a.label,
              onClick: () => runFixtureAction(a.id, item, ctx),
            })),
          ]
        : [
            {
              id: "report-issue",
              label: "Create Task",
              onClick: () => runFixtureAction("report-issue", item, ctx),
            },
            {
              id: "ignore",
              label: "Ignore",
              onClick: () => runFixtureAction("ignore", item, ctx),
            },
          ];
    const minor = actionsList.find((a) => a.id === "ignore" || a.id === "dismiss");
    const primaryOnly = actionsList.filter((a) => a.id !== "ignore" && a.id !== "dismiss");
    const primaryAction = primaryOnly[0];
    const minorFromExtras = !minor && primaryOnly.length > 1 ? primaryOnly[1] : undefined;

    return (
      <OperationalStreamCard
        id={`issues-signal-${item.id}`}
        issuesStreamKind="urgent"
        cardRef={(node) => {
          attentionCardRefs.current[item.id] = node;
        }}
        icon={icon}
        thumbnailUrl={thumbnailUrl}
        title={item.title}
        context={item.context}
        description={item.description}
        imageUrl={item.imageUrl}
        accent="red"
        emphasis="standard"
        actions={primaryAction ? [primaryAction] : actionsList.slice(0, 1)}
        minorLinkAction={minor ?? minorFromExtras}
        onCardActivate={cardActivate}
      />
    );
  }

  if (item.group === "review") {
    const icon = item.signalKind
      ? signalKindIcon(item.signalKind, "text-primary-deep")
      : <HelpCircle className="h-4 w-4 text-primary-deep" />;

    const isSample = isOnboardingSampleNotification(item);
    const primaryId = item.fixtureActions?.primary.id ?? "signal-review";
    const secondaryRaw = item.fixtureActions?.secondary ?? [];
    const overflowFromFixtures = secondaryRaw.filter((a) => a.id !== "dismiss");
    const reviewAction = isSample
      ? {
          id: item.fixtureActions?.primary.id ?? "delete-sample",
          label: item.fixtureActions?.primary.label ?? "DELETE THIS",
          onClick: () =>
            runFixtureAction(item.fixtureActions?.primary.id ?? "delete-sample", item, ctx),
        }
      : {
          id: primaryId,
          label: "Review",
          onClick: () => runFixtureAction(primaryId, item, ctx),
        };
    const overflowActions = isSample
      ? []
      : [
          ...overflowFromFixtures.map((a) => ({
            id: a.id,
            label: a.label,
            onClick: () => runFixtureAction(a.id, item, ctx),
          })),
          ...(item.complianceSeed && !overflowFromFixtures.some((a) => a.id === "signal-convert")
            ? [
                {
                  id: "signal-convert",
                  label: "Convert to record",
                  onClick: () => runFixtureAction("signal-convert", item, ctx),
                },
              ]
            : []),
        ];

    return (
      <OperationalStreamCard
        id={`issues-signal-${item.id}`}
        issuesStreamKind="review"
        cardRef={(node) => {
          attentionCardRefs.current[item.id] = node;
        }}
        issuesMetaLine={item.context?.trim() || undefined}
        icon={icon}
        thumbnailUrl={thumbnailUrl}
        title={item.title}
        context={item.context}
        confidenceLevel={isSample ? undefined : item.confidenceLevel ?? "medium"}
        actions={[reviewAction]}
        overflowActions={overflowActions}
        dismissAction={
          isSample
            ? null
            : {
                id: "dismiss",
                label: "Dismiss",
                onClick: () => runFixtureAction("dismiss", item, ctx),
              }
        }
        onCardActivate={cardActivate}
      />
    );
  }

  const isSample = isOnboardingSampleNotification(item);
  const icon = item.signalKind
    ? signalKindIcon(item.signalKind)
    : <Upload className="h-4 w-4 text-muted-foreground" />;
  const actionsList =
    item.fixtureActions != null
      ? [
          {
            id: item.fixtureActions.primary.id,
            label: item.fixtureActions.primary.label,
            onClick: () => runFixtureAction(item.fixtureActions!.primary.id, item, ctx),
          },
          ...(item.fixtureActions.secondary ?? []).map((a) => ({
            id: a.id,
            label: a.label,
            onClick: () => runFixtureAction(a.id, item, ctx),
          })),
        ]
      : [
          {
            id: "signal-open",
            label: "View",
            onClick: () => runFixtureAction("signal-open", item, ctx),
          },
          {
            id: "dismiss",
            label: "Dismiss",
            onClick: () => runFixtureAction("dismiss", item, ctx),
          },
        ];

  const category = item.categoryTag
    ? { label: item.categoryTag, variant: item.categoryTagVariant ?? "default" }
    : signalCategoryForKind(item.signalKind);

  const recentSubtitle = isSample
    ? ONBOARDING_SAMPLE_LABEL
    : item.recentSubtitle?.trim() ||
      formatRecentSignalSubtitle(item.context, item.signalKind) ||
      item.context;

  return (
    <OperationalStreamCard
      id={`issues-signal-${item.id}`}
      issuesStreamKind="recent"
      cardRef={(node) => {
        attentionCardRefs.current[item.id] = node;
      }}
      recentSignalMetaLine={recentSubtitle}
      categoryTag={isSample ? undefined : category?.label}
      categoryTagVariant={isSample ? undefined : category?.variant}
      icon={icon}
      thumbnailUrl={thumbnailUrl}
      title={item.title}
      context={item.context}
      actions={isSample ? actionsList.slice(0, 1) : actionsList}
      onCardActivate={cardActivate}
    />
  );
}
