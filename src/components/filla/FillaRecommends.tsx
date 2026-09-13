import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { performSuggestionAction } from "@/lib/signals/performSuggestionAction";
import type { ActionableSuggestion } from "@/lib/signals/actionableSuggestionTypes";

export type FillaRecommendsProps = {
  suggestion: ActionableSuggestion | null;
  onPrimaryAction?: (suggestion: ActionableSuggestion) => void;
  onDismiss?: (suggestion: ActionableSuggestion) => void;
  onSnooze?: (suggestion: ActionableSuggestion) => void;
  variant?: "rail" | "compact" | "feed";
  className?: string;
};

/**
 * Operational “Filla recommends” callout. Hidden when there is no actionable suggestion.
 * Distinct from InstructionPanel, which is for usage tutorials.
 */
export function FillaRecommends({
  suggestion,
  onPrimaryAction,
  onDismiss,
  onSnooze,
  variant = "rail",
  className,
}: FillaRecommendsProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  if (!suggestion) return null;

  const compact = variant === "compact";
  const feed = variant === "feed";

  const handlePrimary = () => {
    if (onPrimaryAction) {
      onPrimaryAction(suggestion);
      return;
    }
    performSuggestionAction(suggestion.action);
  };

  return (
    <section
      className={cn(
        "min-w-0",
        feed && "rounded-xl bg-card/70 px-3 py-3 shadow-e1",
        className
      )}
      aria-label="Filla recommends"
    >
      <div
        className={cn(
          "grid grid-cols-[auto_1fr] items-start",
          compact ? "gap-x-2 gap-y-1" : "gap-2.5"
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-start justify-center",
            compact ? "h-[29px] w-[15px]" : "h-9 w-[21px]"
          )}
          aria-hidden
        >
          <FillaIcon size={compact ? 20 : 24} className="opacity-90" />
        </div>
        <div className={cn("min-w-0", compact ? "space-y-1" : "space-y-2")}>
          <p className="font-mono text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Filla recommends
          </p>
          <h3
            className={cn(
              "font-semibold leading-snug text-ink",
              compact ? "text-xs tracking-[-0.4px]" : "text-sm"
            )}
          >
            {suggestion.headline}
          </h3>
          <p
            className={cn(
              "leading-snug text-foreground/85",
              compact ? "text-xs" : "text-sm"
            )}
          >
            {suggestion.message}
          </p>
          {suggestion.confidence === "qualified" && suggestion.kind === "duplicate_report" ? (
            <p className="text-2xs text-muted-foreground">
              Match is based on related wording in Filla, not a linked asset.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={handlePrimary}
            >
              {suggestion.action.label}
            </Button>
            {onSnooze ? (
              <button
                type="button"
                className="text-2xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => onSnooze(suggestion)}
              >
                Snooze
              </button>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                className="text-2xs font-medium text-muted-foreground hover:text-foreground"
                onClick={() => onDismiss(suggestion)}
              >
                Dismiss
              </button>
            ) : null}
          </div>

          {suggestion.evidence.length > 0 && !compact ? (
            <div className="pt-1">
              <button
                type="button"
                className="flex items-center gap-1 text-2xs font-medium text-muted-foreground hover:text-foreground"
                aria-expanded={evidenceOpen}
                onClick={() => setEvidenceOpen((open) => !open)}
              >
                Evidence
                <ChevronDown
                  className={cn("h-3 w-3 transition-transform", evidenceOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
              {evidenceOpen ? (
                <ul className="mt-1.5 space-y-1">
                  {suggestion.evidence.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="block max-w-full truncate text-left text-xs text-foreground/80 underline-offset-2 hover:text-primary hover:underline"
                        onClick={() => performSuggestionAction(item.action)}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
