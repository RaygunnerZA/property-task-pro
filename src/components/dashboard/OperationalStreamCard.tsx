import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  intakeAddRecordMicroClassName,
  intakeReportIssueMicroClassName,
} from "@/lib/intake-action-buttons";

type CardAccent = "red" | "amber" | "green" | "slate" | "teal";

/** Timeline = lightweight; standard = default; elevated = decision-queue emphasis */
type StreamCardEmphasis = "minimal" | "standard" | "elevated";

interface CardAction {
  id: string;
  label: string;
  onClick: () => void;
}

interface OperationalStreamCardProps {
  id: string;
  icon: ReactNode;
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

function streamActionButtonClass(actionId: string) {
  if (actionId === "report-issue" || actionId === "create-inspection-task") {
    return intakeReportIssueMicroClassName;
  }
  if (actionId === "add-record") return intakeAddRecordMicroClassName;
  if (actionId === "signal-review") return intakeAddRecordMicroClassName;
  if (actionId === "signal-convert") return intakeAddRecordMicroClassName;
  if (actionId === "signal-assign") {
    return cn(
      "inline-flex items-center justify-center rounded-[8px] border-0 px-2 py-1 text-[11px] font-semibold text-foreground",
      "bg-background shadow-e1 transition-all hover:shadow-md"
    );
  }
  if (actionId === "signal-open") {
    return cn(
      "inline-flex items-center justify-center rounded-[8px] border-0 px-2 py-1 text-[11px] font-medium text-foreground/90",
      "bg-muted/45 shadow-sm transition-all hover:bg-muted/60 hover:shadow-e1"
    );
  }
  return cn(
    "text-[11px] rounded-[8px] px-2 py-1 bg-background shadow-e1 hover:shadow-e2 transition-all"
  );
}

export function OperationalStreamCard({
  id,
  icon,
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
}: OperationalStreamCardProps) {
  const footerVisible =
    actionsVisibility === "always"
      ? "opacity-100 pt-2"
      : "max-h-0 opacity-0 overflow-hidden transition-all duration-[140ms] group-hover:max-h-48 group-hover:opacity-100 group-focus-within:max-h-48 group-focus-within:opacity-100 pt-0 group-hover:pt-2 group-focus-within:pt-2";

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
          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{context}</p>
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
              {actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
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
                </div>
              )}
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
