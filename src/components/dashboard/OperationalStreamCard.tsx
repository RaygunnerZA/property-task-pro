import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type CardAccent = "red" | "amber" | "green" | "slate" | "teal";

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
  description?: string;
  statusText?: string;
  imageUrl?: string | null;
  accent?: CardAccent;
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
  teal: "bg-[#8EC9CE]",
};

export function OperationalStreamCard({
  id,
  icon,
  title,
  context,
  hint,
  description,
  statusText,
  imageUrl,
  accent = "slate",
  actions = [],
  onClick,
  cardRef,
  className,
}: OperationalStreamCardProps) {
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
        "group relative rounded-xl bg-card/60 shadow-e1 hover:shadow-e2 transition-all duration-[140ms]",
        "overflow-hidden px-3 py-2.5 cursor-default",
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
          {hint && <p className="text-[11px] text-muted-foreground mt-1 truncate">{hint}</p>}

          {(description || statusText || actions.length > 0) && (
            <div className="max-h-0 opacity-0 overflow-hidden transition-all duration-[140ms] group-hover:max-h-40 group-hover:opacity-100 group-focus-within:max-h-40 group-focus-within:opacity-100 pt-0 group-hover:pt-2 group-focus-within:pt-2">
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
                      className="text-[11px] rounded-[8px] px-2 py-1 bg-background shadow-e1 hover:shadow-e2 transition-all"
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
