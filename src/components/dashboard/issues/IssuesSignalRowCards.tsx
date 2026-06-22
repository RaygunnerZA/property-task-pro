import { type KeyboardEvent, type ReactNode, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { IssuesStreamThumbnail } from "@/components/dashboard/issues/IssuesStreamThumbnail";
import {
  issuesSignalOverflowButtonClassName,
  issuesSignalReviewButtonClassName,
  issuesSignalSecondaryButtonClassName,
  SignalCategoryTag,
  SignalConfidenceIndicator,
  type SignalCategoryVariant,
  type SignalConfidenceLevel,
} from "@/components/dashboard/issues/IssuesSignalListParts";

interface CardAction {
  id: string;
  label: string;
  onClick: () => void;
}

type RowBaseProps = {
  id: string;
  thumbnailUrl: string;
  title: string;
  subtitle?: string;
  cardRef?: (node: HTMLDivElement | null) => void;
  className?: string;
  onCardActivate?: () => void;
};

export function IssuesRecentSignalRow({
  id,
  thumbnailUrl,
  title,
  subtitle,
  categoryTag,
  categoryTagVariant,
  viewAction,
  dismissAction,
  cardRef,
  className,
  onCardActivate,
}: RowBaseProps & {
  categoryTag?: string;
  categoryTagVariant?: SignalCategoryVariant;
  viewAction?: CardAction;
  dismissAction?: CardAction;
}) {
  return (
    <RowShell
      id={id}
      cardRef={cardRef}
      className={className}
      onCardActivate={onCardActivate}
      metaFirst
      thumbnailUrl={thumbnailUrl}
      title={title}
      subtitle={subtitle}
      trailing={
        <div className="flex shrink-0 items-center gap-2 self-center">
          {categoryTag ? (
            <SignalCategoryTag label={categoryTag} variant={categoryTagVariant ?? "default"} />
          ) : null}
          <div className="flex flex-col gap-1 sm:h-7 sm:flex-row sm:items-center sm:gap-2">
            {viewAction ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  viewAction.onClick();
                }}
                className={issuesSignalReviewButtonClassName}
              >
                {viewAction.label === "Open" ? "View" : viewAction.label}
              </button>
            ) : null}
            {dismissAction ? (
              <button
                type="button"
                className={issuesSignalSecondaryButtonClassName}
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
      }
    />
  );
}

export function IssuesReviewSignalRow({
  id,
  thumbnailUrl,
  title,
  subtitle,
  confidenceLevel = "medium",
  reviewAction,
  dismissAction,
  overflowActions = [],
  cardRef,
  className,
  onCardActivate,
}: RowBaseProps & {
  confidenceLevel?: SignalConfidenceLevel;
  reviewAction?: CardAction;
  dismissAction?: CardAction;
  overflowActions?: CardAction[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuActions = [
    ...overflowActions,
    ...(dismissAction && !overflowActions.some((action) => action.id === dismissAction.id)
      ? [dismissAction]
      : []),
  ];

  return (
    <RowShell
      id={id}
      cardRef={cardRef}
      className={className}
      onCardActivate={onCardActivate}
      thumbnailUrl={thumbnailUrl}
      title={title}
      subtitle={subtitle}
      trailing={
        <SignalRowTrailingRail>
          <SignalConfidenceIndicator level={confidenceLevel} />
          {reviewAction ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                reviewAction.onClick();
              }}
              className={issuesSignalReviewButtonClassName}
            >
              {reviewAction.label}
            </button>
          ) : null}
          <SignalRowOverflowMenu actions={menuActions} open={menuOpen} onOpenChange={setMenuOpen} />
        </SignalRowTrailingRail>
      }
    />
  );
}

function SignalRowOverflowMenu({
  actions,
  open,
  onOpenChange,
}: {
  actions: CardAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
        className={issuesSignalOverflowButtonClassName}
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && actions.length > 0 ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-[8px] border border-border/60 bg-card py-1 shadow-md"
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-muted/40"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
                action.onClick();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Right rail: confidence / tags + actions on one centered row. */
function SignalRowTrailingRail({ children }: { children: ReactNode }) {
  return <div className="flex h-7 shrink-0 items-center gap-2 self-center">{children}</div>;
}

function RowShell({
  id,
  thumbnailUrl,
  title,
  subtitle,
  trailing,
  metaFirst = false,
  cardRef,
  className,
  onCardActivate,
}: RowBaseProps & {
  trailing: ReactNode;
  metaFirst?: boolean;
}) {
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
      className={cn("min-w-0", className, onCardActivate && "cursor-pointer")}
    >
      <div className="flex items-center gap-3">
        <IssuesStreamThumbnail url={thumbnailUrl} alt={title} />
        <div className="min-w-0 flex-1">
          {metaFirst && subtitle?.trim() ? (
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1">{subtitle.trim()}</p>
          ) : null}
          <p className={cn("text-sm font-medium tracking-[-0.1px] text-foreground leading-snug", metaFirst && subtitle?.trim() && "mt-0.5")}>
            {title}
          </p>
          {!metaFirst && subtitle?.trim() ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-1">{subtitle.trim()}</p>
          ) : null}
        </div>
        {trailing}
      </div>
    </div>
  );
}
