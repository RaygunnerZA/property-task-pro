import type { MutableRefObject } from "react";
import { AlertTriangle, HelpCircle, Upload } from "lucide-react";
import { OperationalStreamCard } from "@/components/dashboard/OperationalStreamCard";
import type { WorkbenchAttentionSelectPayload } from "@/components/dashboard/SignalFeedDetailPanel";
import {
  attentionItemToSignalSnapshot,
  type AttentionItem,
} from "@/components/dashboard/issues/issuesAttentionItem";
import { formatRecentSignalSubtitle, signalCategoryForKind } from "@/lib/signalDisplayMeta";
import { resolveAttentionStreamThumbnail } from "@/lib/taskIllustration";
import { signalKindIcon } from "@/lib/signalKindIcons";
import type { IntakeMode } from "@/types/intake";

export type IssuesSignalCardProps = {
  item: AttentionItem;
  attentionCardRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  resolveAttentionItem: (id: string) => void;
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
    addAttentionItemToCompliance: (item: AttentionItem) => void;
    onOpenIntake?: (mode: IntakeMode) => void;
    onMessageClick?: (messageId: string) => void;
  }
) {
  const { resolveAttentionItem, addAttentionItemToCompliance, onOpenIntake, onMessageClick } = ctx;
  switch (actionId) {
    case "report-issue":
      onOpenIntake?.("report_issue");
      resolveAttentionItem(item.id);
      break;
    case "ignore":
    case "dismiss":
      resolveAttentionItem(item.id);
      break;
    case "signal-open":
      if (item.messageId) onMessageClick?.(item.messageId);
      resolveAttentionItem(item.id);
      break;
    case "signal-review":
      onOpenIntake?.("add_record");
      resolveAttentionItem(item.id);
      break;
    case "treat-as-issue":
      onOpenIntake?.("report_issue");
      resolveAttentionItem(item.id);
      break;
    case "signal-assign":
      onOpenIntake?.("report_issue");
      resolveAttentionItem(item.id);
      break;
    case "signal-convert":
      if (item.complianceSeed) addAttentionItemToCompliance(item);
      else onOpenIntake?.("add_record");
      resolveAttentionItem(item.id);
      break;
    default:
      resolveAttentionItem(item.id);
  }
}

/**
 * Signal row in Issues triage — delegates review/recent to horizontal row cards via OperationalStreamCard.
 */
export function IssuesSignalCard({
  item,
  attentionCardRefs,
  resolveAttentionItem,
  addAttentionItemToCompliance,
  onOpenIntake,
  onMessageClick,
  onAttentionItemSelect,
}: IssuesSignalCardProps) {
  const ctx = {
    resolveAttentionItem,
    addAttentionItemToCompliance,
    onOpenIntake,
    onMessageClick,
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
      ? signalKindIcon(item.signalKind, "text-amber-700")
      : <AlertTriangle className="h-4 w-4 text-amber-600" />;
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
              label: "Report Issue",
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
      ? signalKindIcon(item.signalKind, "text-teal-800")
      : <HelpCircle className="h-4 w-4 text-teal-800" />;

    const primaryId = item.fixtureActions?.primary.id ?? "signal-review";
    const secondaryRaw = item.fixtureActions?.secondary ?? [];
    const overflowFromFixtures = secondaryRaw.filter((a) => a.id !== "dismiss");
    const reviewAction = {
      id: primaryId,
      label: "Review",
      onClick: () => runFixtureAction(primaryId, item, ctx),
    };
    const overflowActions = [
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
        confidenceLevel={item.confidenceLevel ?? "medium"}
        actions={[reviewAction]}
        overflowActions={overflowActions}
        dismissAction={{
          id: "dismiss",
          label: "Dismiss",
          onClick: () => runFixtureAction("dismiss", item, ctx),
        }}
        onCardActivate={cardActivate}
      />
    );
  }

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

  const recentSubtitle =
    item.recentSubtitle?.trim() ||
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
      categoryTag={category?.label}
      categoryTagVariant={category?.variant}
      icon={icon}
      thumbnailUrl={thumbnailUrl}
      title={item.title}
      context={item.context}
      actions={actionsList}
      onCardActivate={cardActivate}
    />
  );
}
