import { type ReactNode, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import {
  intakeAddRecordMicroClassName,
  intakeReportIssueMicroClassName,
} from "@/lib/intake-action-buttons";

type CardAccent = "red" | "amber" | "green" | "slate" | "teal";

/** Timeline = lightweight; standard = default; elevated = decision-queue emphasis */
type StreamCardEmphasis = "minimal" | "standard" | "elevated";

/** Issues-tab layouts: calmer hierarchy, fewer pill controls */
export type IssuesStreamCardKind = "recent" | "review" | "urgent";

interface CardAction {
  id: string;
  label: string;
  onClick: () => void;
}

interface OperationalStreamCardProps {
  id: string;
  icon: ReactNode;
  /** Legacy top chip (non-feed layout only). Prefer `footChip` for Recent / urgent feed cards. */
  typeChip?: string;
  /** Second line for review queue, e.g. “AI SUGGESTION • NEEDS CLASSIFICATION” */
  reviewBanner?: string;
  /** “Why this is here:” explanation for judgment queue */
  whyHere?: string;
  title: string;
  context: string;
  hint?: string;
  /** Small decision / triage labels (e.g. “Missing record”) */
  labels?: string[];
  description?: string;
  statusText?: string;
  imageUrl?: string | null;
  accent?: CardAccent;
  emphasis?: StreamCardEmphasis;
  /** When “always”, description + actions stay visible (decision queue CTAs). */
  actionsVisibility?: "hover" | "always";
  actions?: CardAction[];
  onClick?: () => void;
  /** Whole-card activate (Issues layouts): inner buttons use stopPropagation so CTAs stay independent. */
  onCardActivate?: () => void;
  cardRef?: (node: HTMLDivElement | null) => void;
  className?: string;
  /**
   * Feed-style cards: title → (description on hover) → meta → bottom type chip; actions on hover.
   * Set with `actionsVisibility="hover"` for Recent timeline + urgent strip.
   */
  footChip?: string;
  /** Issues tab: dedicated calmer layouts (bypasses legacy feed / chip rows). */
  issuesStreamKind?: IssuesStreamCardKind;
  /** Single muted type line for Issues “Recent signals” (not a chip). */
  timelineTypeLabel?: string;
  /** Issues “Recent signals”: one all-caps mono line above the title (source • time). */
  recentSignalMetaLine?: string;
  /** Issues “Needs review”: inline text dismiss (separate from `actions`). */
  dismissAction?: CardAction | null;
  /** Issues “Needs review”: one line only (prefer why over context). */
  reviewShortReason?: string;
  /** Issues “Needs review”: mono meta above title (e.g. context line), same style as Recent. */
  issuesMetaLine?: string;
  /** Issues “Urgent”: secondary inline text (e.g. Ignore). */
  minorLinkAction?: CardAction | null;
}

const accentClassMap: Record<CardAccent, string> = {
  red: "bg-destructive/70",
  amber: "bg-amber-500/80",
  green: "bg-emerald-500/80",
  slate: "bg-slate-400/80",
  teal: "bg-primary/80",
};

const emphasisShellMap: Record<StreamCardEmphasis, string> = {
  minimal:
    "rounded-xl bg-card/50 shadow-sm hover:shadow-md px-2.5 py-2 transition-all duration-\[180ms\]",
  standard: "rounded-xl bg-card/60 shadow-e1 hover:shadow-e2 px-3 py-2.5 transition-all duration-\[140ms\]",
  elevated:
    "rounded-xl bg-card/85 shadow-md hover:shadow-lg px-3 py-2.5 ring-1 ring-[#8EC9CE]/22 transition-all duration-\[180ms\]",
};

const inlineMinorLinkClass = cn(
  "text-[11px] font-medium text-muted-foreground underline-offset-2",
  "hover:text-foreground hover:underline bg-transparent border-0 p-0 cursor-pointer shrink-0"
);

/** Dismiss / Ignore on Issues streams — discrete text link (not a raised chip) so exits stay visually quiet. */
const issuesDismissOrIgnoreLinkClassName = inlineMinorLinkClass;

/** Issues signal cards — matches Recent “EMAIL FROM … • DATE” meta (JetBrains Mono 10 / 600, caps). */
export const ISSUES_STREAM_META_CLASSNAME =
  "text-[10px] font-mono font-semibold uppercase tracking-wide text-muted-foreground leading-snug line-clamp-1";

function streamActionButtonClass(actionId: string, actionLabel?: string) {
  const id = actionId.toLowerCase();
  const label = (actionLabel ?? "").toLowerCase();
  const isIssueCta =
    id === "report-issue" ||
    id === "create-inspection-task" ||
    id === "treat-as-issue" ||
    label.includes("report issue") ||
    label.includes("treat as issue");

  if (isIssueCta) {
    return intakeReportIssueMicroClassName;
  }
  if (actionId === "add-record") return intakeAddRecordMicroClassName;
  if (actionId === "signal-review") return intakeAddRecordMicroClassName;
  if (actionId === "signal-convert") return intakeAddRecordMicroClassName;
  /** Resolve, Assign permissions, Assign location — primary triage (teal). */
  if (actionId === "signal-assign") return intakeAddRecordMicroClassName;
  if (actionId === "signal-open") {
    return intakeAddRecordMicroClassName;
  }
  return cn(
    "inline-flex items-center justify-center rounded-[8px] border-0 px-2 py-1 text-[11px] font-semibold text-foreground",
    "bg-background shadow-e1 transition-all hover:shadow-md"
  );
}

function ActionRow({ actions }: { actions: CardAction[] }) {
  return (
    <>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            action.onClick();
          }}
          className={streamActionButtonClass(action.id, action.label)}
        >
          {action.label}
        </button>
      ))}
    </>
  );
}

function IssuesRecentCard({
  id,
  cardRef,
  className,
  accent,
  emphasis,
  icon,
  title,
  description,
  imageUrl,
  recentSignalMetaLine,
  actions,
  onCardActivate,
}: Pick<
  OperationalStreamCardProps,
  | "id"
  | "cardRef"
  | "className"
  | "accent"
  | "emphasis"
  | "icon"
  | "title"
  | "description"
  | "imageUrl"
  | "recentSignalMetaLine"
  | "actions"
  | "onCardActivate"
>) {
  const viewAction = actions.find((a) => a.id === "signal-open");
  const dismissAction = actions.find((a) => a.id === "dismiss" || a.id === "ignore");
  const shell = emphasisShellMap[emphasis ?? "minimal"];

  return (
    <div
      id={id}
      ref={cardRef}
      role={onCardActivate ? "button" : undefined}
      tabIndex={onCardActivate ? 0 : undefined}
      onClick={onCardActivate}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (!onCardActivate) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onCardActivate();
        }
      }}
      className={cn("group relative overflow-hidden", shell, className, onCardActivate && "cursor-pointer")}
    >
      <div className={cn("absolute left-0 top-0 h-full w-1", accentClassMap[accent ?? "slate"])} />
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-7 w-7 rounded-[8px] bg-muted/60 shadow-e1 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1 min-h-0">
          {recentSignalMetaLine?.trim() ? (
            <p className={ISSUES_STREAM_META_CLASSNAME}>{recentSignalMetaLine.trim()}</p>
          ) : null}
          <p
            className={cn(
              "text-sm font-semibold text-foreground leading-snug",
              recentSignalMetaLine?.trim() ? "mt-1.5" : ""
            )}
          >
            {title}
          </p>
          {description ? (
            <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-0.5 min-w-0 max-w-[13rem]">
          {viewAction ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                viewAction.onClick();
              }}
              className={streamActionButtonClass(viewAction.id, viewAction.label)}
            >
              {viewAction.label === "Open" ? "View" : viewAction.label}
            </button>
          ) : null}
          {dismissAction ? (
            <button
              type="button"
              className={cn(issuesDismissOrIgnoreLinkClassName, "text-right")}
              onClick={(e) => {
                e.stopPropagation();
                dismissAction.onClick();
              }}
            >
              {dismissAction.label}
            </button>
          ) : null}
        </div>
        {imageUrl ? (
          <div className="h-14 w-20 rounded-[8px] bg-muted/40 overflow-hidden shadow-e1 shrink-0">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function IssuesReviewCard({
  id,
  cardRef,
  className,
  accent,
  emphasis,
  icon,
  title,
  issuesMetaLine,
  reviewShortReason,
  actions,
  dismissAction,
  onCardActivate,
}: Pick<
  OperationalStreamCardProps,
  | "id"
  | "cardRef"
  | "className"
  | "accent"
  | "emphasis"
  | "icon"
  | "title"
  | "issuesMetaLine"
  | "reviewShortReason"
  | "actions"
  | "dismissAction"
  | "onCardActivate"
>) {
  const shell = emphasisShellMap[emphasis ?? "elevated"];
  const core = actions.filter((a) => a.id !== "dismiss" && a.id !== "ignore");
  const totalCtas = core.length + (dismissAction ? 1 : 0);
  const stackVertically = totalCtas === 2;

  return (
    <div
      id={id}
      ref={cardRef}
      role={onCardActivate ? "button" : undefined}
      tabIndex={onCardActivate ? 0 : undefined}
      onClick={onCardActivate}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (!onCardActivate) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onCardActivate();
        }
      }}
      className={cn("relative overflow-hidden", shell, className, onCardActivate && "cursor-pointer")}
    >
      <div className={cn("absolute left-0 top-0 h-full w-1", accentClassMap[accent ?? "teal"])} />
      <div className="flex items-start gap-3 pl-0.5">
        <div className="mt-0.5 h-7 w-7 shrink-0 rounded-[8px] bg-muted/60 shadow-e1 flex items-center justify-center">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          {issuesMetaLine?.trim() ? <p className={ISSUES_STREAM_META_CLASSNAME}>{issuesMetaLine.trim()}</p> : null}
          <p
            className={cn(
              "text-sm font-semibold text-foreground leading-snug pt-0.5",
              issuesMetaLine?.trim() ? "mt-1" : ""
            )}
          >
            {title}
          </p>
          {reviewShortReason?.trim() ? (
            <p className="mt-1.5 text-xs text-muted-foreground leading-snug line-clamp-2">{reviewShortReason.trim()}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex shrink-0 flex-col gap-1.5 self-start pt-0.5 min-w-0 max-w-[13rem]",
            stackVertically ? "items-end" : "items-stretch",
          )}
        >
          {stackVertically ? (
            <>
              {core.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  className={streamActionButtonClass(action.id, action.label)}
                >
                  {action.label}
                </button>
              ))}
              {dismissAction ? (
                <button
                  type="button"
                  className={cn(issuesDismissOrIgnoreLinkClassName, "text-right")}
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissAction.onClick();
                  }}
                >
                  {dismissAction.label}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-1.5 gap-y-1.5 justify-items-stretch">
                {core.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                    }}
                    className={streamActionButtonClass(action.id, action.label)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              {dismissAction ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className={cn(issuesDismissOrIgnoreLinkClassName, "text-right")}
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissAction.onClick();
                    }}
                  >
                    {dismissAction.label}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function IssuesUrgentCard({
  id,
  cardRef,
  className,
  accent,
  emphasis,
  icon,
  title,
  context,
  description,
  imageUrl,
  actions,
  minorLinkAction,
  onCardActivate,
}: Pick<
  OperationalStreamCardProps,
  | "id"
  | "cardRef"
  | "className"
  | "accent"
  | "emphasis"
  | "icon"
  | "title"
  | "context"
  | "description"
  | "imageUrl"
  | "actions"
  | "minorLinkAction"
  | "onCardActivate"
>) {
  const primary = actions[0];
  const minor =
    minorLinkAction ??
    actions.find((a) => a.id === "ignore" || a.id === "dismiss");
  const shell = emphasisShellMap[emphasis ?? "standard"];

  return (
    <div
      id={id}
      ref={cardRef}
      role={onCardActivate ? "button" : undefined}
      tabIndex={onCardActivate ? 0 : undefined}
      onClick={onCardActivate}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (!onCardActivate) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onCardActivate();
        }
      }}
      className={cn("group relative overflow-hidden", shell, className, onCardActivate && "cursor-pointer")}
    >
      <div className={cn("absolute left-0 top-0 h-full w-1", accentClassMap[accent ?? "red"])} />
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-7 w-7 rounded-[8px] bg-muted/60 shadow-e1 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          {context?.trim() ? <p className={ISSUES_STREAM_META_CLASSNAME}>{context.trim()}</p> : null}
          <p className={cn("text-sm font-semibold text-foreground leading-snug", context?.trim() ? "mt-1.5" : "")}>
            {title}
          </p>
          {description ? (
            <p className="mt-1 hidden text-xs leading-snug text-foreground/90 group-hover:block">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-0.5 min-w-0 max-w-[13rem]">
          {primary ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                primary.onClick();
              }}
              className={streamActionButtonClass(primary.id, primary.label)}
            >
              {primary.label}
            </button>
          ) : null}
          {minor && minor.id !== primary?.id ? (
            <button
              type="button"
              className={
                minor.id === "ignore" || minor.id === "dismiss"
                  ? cn(issuesDismissOrIgnoreLinkClassName, "text-right py-0.5")
                  : streamActionButtonClass(minor.id, minor.label)
              }
              onClick={(e) => {
                e.stopPropagation();
                minor.onClick();
              }}
            >
              {minor.label}
            </button>
          ) : null}
        </div>
        {imageUrl ? (
          <div className="h-14 w-20 rounded-[8px] bg-muted/40 overflow-hidden shadow-e1 shrink-0">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function OperationalStreamCard({
  id,
  icon,
  typeChip,
  reviewBanner,
  whyHere,
  title,
  context,
  hint,
  labels = [],
  description,
  statusText,
  imageUrl,
  accent = "slate",
  emphasis = "standard",
  actionsVisibility = "hover",
  actions = [],
  onClick,
  onCardActivate,
  cardRef,
  className,
  footChip,
  issuesStreamKind,
  timelineTypeLabel,
  dismissAction,
  minorLinkAction,
  reviewShortReason,
  recentSignalMetaLine,
  issuesMetaLine,
}: OperationalStreamCardProps) {
  if (issuesStreamKind === "recent") {
    return (
      <IssuesRecentCard
        id={id}
        cardRef={cardRef}
        className={className}
        accent={accent}
        emphasis={emphasis}
        icon={icon}
        title={title}
        description={description}
        imageUrl={imageUrl}
        recentSignalMetaLine={recentSignalMetaLine}
        actions={actions}
        onCardActivate={onCardActivate}
      />
    );
  }

  if (issuesStreamKind === "review") {
    const reason =
      (reviewShortReason ?? "").trim() ||
      (whyHere ?? "").trim() ||
      (description ?? "").trim() ||
      undefined;
    const meta = (issuesMetaLine ?? "").trim() || (context ?? "").trim() || undefined;
    return (
      <IssuesReviewCard
        id={id}
        cardRef={cardRef}
        className={className}
        accent={accent}
        emphasis={emphasis}
        icon={icon}
        title={title}
        issuesMetaLine={meta}
        reviewShortReason={reason}
        actions={actions}
        dismissAction={dismissAction}
        onCardActivate={onCardActivate}
      />
    );
  }

  if (issuesStreamKind === "urgent") {
    const primaryActions = actions.filter((a) => a.id !== "ignore" && a.id !== "dismiss");
    return (
      <IssuesUrgentCard
        id={id}
        cardRef={cardRef}
        className={className}
        accent={accent}
        emphasis={emphasis}
        icon={icon}
        title={title}
        context={context}
        description={description}
        imageUrl={imageUrl}
        actions={primaryActions.length > 0 ? primaryActions : actions}
        minorLinkAction={minorLinkAction}
        onCardActivate={onCardActivate}
      />
    );
  }

  const feedLayout = Boolean(footChip?.trim()) && actionsVisibility === "hover";

  const footerVisible =
    actionsVisibility === "always"
      ? "opacity-100 pt-2"
      : "max-h-0 opacity-0 overflow-hidden transition-all duration-\[140ms\] group-hover:max-h-48 group-hover:opacity-100 group-focus-within:max-h-48 group-focus-within:opacity-100 pt-0 group-hover:pt-2 group-focus-within:pt-2";

  if (feedLayout) {
    return (
      <div
        id={id}
        ref={cardRef}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : -1}
        onClick={onClick}
        onKeyDown={(event) => {
          if (!onClick) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
          }
        }}
        className={cn(
          "group relative overflow-hidden cursor-default",
          emphasisShellMap[emphasis],
          onClick && "cursor-pointer",
          className
        )}
      >
        <div className={cn("absolute left-0 top-0 h-full w-1", accentClassMap[accent])} />

        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-7 w-7 rounded-[8px] bg-muted/60 shadow-e1 flex items-center justify-center shrink-0">
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>

            {description ? (
              <p className="mt-1 hidden text-xs leading-snug text-foreground/90 group-hover:block">
                <span className="font-medium text-muted-foreground">Description:</span> {description}
              </p>
            ) : null}

            <p className={cn("text-xs text-muted-foreground", description ? "mt-1 group-hover:mt-1" : "mt-1")}>
              {context}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-md bg-muted/70 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-muted-foreground shadow-sm">
                {footChip}
              </span>
              {actions.length > 0 && (
                <div className="hidden flex-wrap gap-1.5 group-hover:flex group-focus-within:flex">
                  <ActionRow actions={actions} />
                </div>
              )}
            </div>
          </div>

          {imageUrl && (
            <div className="h-14 w-20 rounded-[8px] bg-muted/40 overflow-hidden shadow-e1 shrink-0">
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      id={id}
      ref={cardRef}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : -1}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative overflow-hidden cursor-default",
        emphasisShellMap[emphasis],
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className={cn("absolute left-0 top-0 h-full w-1", accentClassMap[accent])} />

      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-7 w-7 rounded-[8px] bg-muted/60 shadow-e1 flex items-center justify-center shrink-0">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          {typeChip && (
            <span className="mb-1 inline-block rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground shadow-sm">
              {typeChip}
            </span>
          )}
          {reviewBanner && (
            <p className="mb-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-[#0d9488]">
              {reviewBanner}
            </p>
          )}
          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{context}</p>
          {whyHere && (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              <span className="font-medium text-foreground/80">Why this is here:</span> {whyHere}
            </p>
          )}
          {labels.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {labels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-muted/55 px-2 py-0.5 text-[10px] font-medium leading-tight text-muted-foreground shadow-sm"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          {hint && <p className="text-[11px] text-muted-foreground mt-1 truncate">{hint}</p>}

          {(description || statusText || actions.length > 0) && (
            <div className={cn(footerVisible, actionsVisibility !== "always" && "overflow-hidden")}>
              {description && <p className="text-xs text-foreground/90 mb-1.5">{description}</p>}
              {statusText && <p className="text-[11px] text-muted-foreground mb-2">{statusText}</p>}
              {actions.length > 0 && <ActionRow actions={actions} />}
            </div>
          )}
        </div>

        {imageUrl && (
          <div className="h-14 w-20 rounded-[8px] bg-muted/40 overflow-hidden shadow-e1 shrink-0">
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}
