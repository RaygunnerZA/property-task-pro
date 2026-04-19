import { type ReactNode } from "react";
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
    "rounded-xl bg-card/50 shadow-sm hover:shadow-md px-2.5 py-2 transition-all duration-[180ms]",
  standard: "rounded-xl bg-card/60 shadow-e1 hover:shadow-e2 px-3 py-2.5 transition-all duration-[140ms]",
  elevated:
    "rounded-xl bg-card/85 shadow-md hover:shadow-lg px-3 py-2.5 ring-1 ring-[#8EC9CE]/22 transition-all duration-[180ms]",
};

/** Secondary micro CTA — matches Needs review row (e.g. Assign location): Inter Tight via `sans`, 11px, semibold (600). */
const streamSecondaryMicroClassName = cn(
  "inline-flex items-center justify-center rounded-[8px] border-0 px-2 py-1 text-[11px] font-semibold text-foreground",
  "bg-background shadow-e1 transition-all hover:shadow-md"
);

const inlineMinorLinkClass = cn(
  "text-[11px] font-medium text-muted-foreground underline-offset-2",
  "hover:text-foreground hover:underline bg-transparent border-0 p-0 cursor-pointer shrink-0"
);

function streamActionButtonClass(actionId: string) {
  if (actionId === "report-issue" || actionId === "create-inspection-task") {
    return intakeReportIssueMicroClassName;
  }
  if (actionId === "add-record") return intakeAddRecordMicroClassName;
  if (actionId === "signal-review") return intakeAddRecordMicroClassName;
  if (actionId === "signal-convert") return intakeAddRecordMicroClassName;
  if (actionId === "signal-assign" || actionId === "dismiss") {
    return streamSecondaryMicroClassName;
  }
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
          className={streamActionButtonClass(action.id)}
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
>) {
  const viewAction = actions.find((a) => a.id === "signal-open");
  const dismissAction = actions.find((a) => a.id === "dismiss" || a.id === "ignore");
  const shell = emphasisShellMap[emphasis ?? "minimal"];

  return (
    <div id={id} ref={cardRef} className={cn("group relative overflow-hidden", shell, className)}>
      <div className={cn("absolute left-0 top-0 h-full w-1", accentClassMap[accent ?? "slate"])} />
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-7 w-7 rounded-[8px] bg-muted/60 shadow-e1 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          {recentSignalMetaLine?.trim() ? (
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wide text-muted-foreground leading-snug line-clamp-1">
              {recentSignalMetaLine.trim()}
            </p>
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
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {viewAction ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  viewAction.onClick();
                }}
                className={streamActionButtonClass(viewAction.id)}
              >
                {viewAction.label === "Open" ? "View" : viewAction.label}
              </button>
            ) : null}
            {dismissAction ? (
              <button type="button" className={inlineMinorLinkClass} onClick={(e) => {
                e.stopPropagation();
                dismissAction.onClick();
              }}>
                {dismissAction.label}
              </button>
            ) : null}
          </div>
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
  reviewShortReason,
  actions,
  dismissAction,
}: Pick<
  OperationalStreamCardProps,
  | "id"
  | "cardRef"
  | "className"
  | "accent"
  | "emphasis"
  | "icon"
  | "title"
  | "reviewShortReason"
  | "actions"
  | "dismissAction"
>) {
  const shell = emphasisShellMap[emphasis ?? "elevated"];
  const core = actions.filter((a) => a.id !== "dismiss" && a.id !== "ignore");
  const primary = core[0];
  const secondary = core[1];

  return (
    <div id={id} ref={cardRef} className={cn("relative overflow-hidden", shell, className)}>
      <div className={cn("absolute left-0 top-0 h-full w-1", accentClassMap[accent ?? "teal"])} />
      <div className="min-w-0 pl-0.5">
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5 h-7 w-7 shrink-0 rounded-[8px] bg-muted/60 shadow-e1 flex items-center justify-center">
            {icon}
          </div>
          <p className="min-w-0 flex-1 text-sm font-semibold text-foreground leading-snug pt-0.5">{title}</p>
        </div>
        {reviewShortReason?.trim() ? (
          <p className="mt-1.5 text-xs text-muted-foreground leading-snug line-clamp-1 pl-[calc(1.75rem+0.5rem)]">
            {reviewShortReason.trim()}
          </p>
        ) : null}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-[calc(1.75rem+0.5rem)]">
          {primary ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                primary.onClick();
              }}
              className={streamActionButtonClass(primary.id)}
            >
              {primary.label}
            </button>
          ) : null}
          {secondary ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                secondary.onClick();
              }}
              className={streamActionButtonClass(secondary.id)}
            >
              {secondary.label}
            </button>
          ) : null}
          {dismissAction ? (
            <button
              type="button"
              className={streamSecondaryMicroClassName}
              onClick={(e) => {
                e.stopPropagation();
                dismissAction.onClick();
              }}
            >
              {dismissAction.label}
            </button>
          ) : null}
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
>) {
  const primary = actions[0];
  const minor =
    minorLinkAction ??
    actions.find((a) => a.id === "ignore" || a.id === "dismiss");
  const shell = emphasisShellMap[emphasis ?? "standard"];

  return (
    <div id={id} ref={cardRef} className={cn("group relative overflow-hidden", shell, className)}>
      <div className={cn("absolute left-0 top-0 h-full w-1", accentClassMap[accent ?? "red"])} />
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-7 w-7 rounded-[8px] bg-muted/60 shadow-e1 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground leading-snug">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{context}</p>
          {description ? (
            <p className="mt-1 hidden text-xs leading-snug text-foreground/90 group-hover:block">{description}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {primary ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  primary.onClick();
                }}
                className={streamActionButtonClass(primary.id)}
              >
                {primary.label}
              </button>
            ) : null}
            {minor && minor.id !== primary?.id ? (
              <button type="button" className={inlineMinorLinkClass} onClick={(e) => {
                e.stopPropagation();
                minor.onClick();
              }}>
                {minor.label}
              </button>
            ) : null}
          </div>
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
  cardRef,
  className,
  footChip,
  issuesStreamKind,
  timelineTypeLabel,
  dismissAction,
  minorLinkAction,
  reviewShortReason,
  recentSignalMetaLine,
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
      />
    );
  }

  if (issuesStreamKind === "review") {
    const reason =
      (reviewShortReason ?? "").trim() ||
      (whyHere ?? "").trim() ||
      (context ?? "").trim() ||
      undefined;
    return (
      <IssuesReviewCard
        id={id}
        cardRef={cardRef}
        className={className}
        accent={accent}
        emphasis={emphasis}
        icon={icon}
        title={title}
        reviewShortReason={reason}
        actions={actions}
        dismissAction={dismissAction}
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
      />
    );
  }

  const feedLayout = Boolean(footChip?.trim()) && actionsVisibility === "hover";

  const footerVisible =
    actionsVisibility === "always"
      ? "opacity-100 pt-2"
      : "max-h-0 opacity-0 overflow-hidden transition-all duration-[140ms] group-hover:max-h-48 group-hover:opacity-100 group-focus-within:max-h-48 group-focus-within:opacity-100 pt-0 group-hover:pt-2 group-focus-within:pt-2";

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
