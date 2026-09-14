import { MoreHorizontal } from "lucide-react";
import { FillaIcon } from "@/components/filla/FillaIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
 * Operational “Filla suggests” callout: one short message, one text action.
 * Matching details and evidence live in the destination flow, not on the card.
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
  if (!suggestion) return null;

  const compact = variant === "compact";
  const feed = variant === "feed";
  const hasMenu = Boolean(onSnooze || onDismiss);

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
      aria-label="Filla suggests"
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
        <div className={cn("min-w-0", compact ? "space-y-1" : "space-y-1.5")}>
          <div className="flex items-start justify-between gap-2">
            <p className="font-mono text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Filla suggests
            </p>
            {hasMenu ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Suggestion options"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[8.5rem] border-0 bg-card shadow-e2">
                  {onSnooze ? (
                    <DropdownMenuItem
                      className="text-xs"
                      onSelect={() => onSnooze(suggestion)}
                    >
                      Snooze
                    </DropdownMenuItem>
                  ) : null}
                  {onDismiss ? (
                    <DropdownMenuItem
                      className="text-xs"
                      onSelect={() => onDismiss(suggestion)}
                    >
                      Dismiss
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          <p
            className={cn(
              "leading-snug text-foreground/90",
              compact ? "text-xs" : "text-sm"
            )}
          >
            {suggestion.message}
          </p>

          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-0.5 pt-0.5 font-medium text-primary hover:underline",
              compact ? "text-xs" : "text-sm"
            )}
            onClick={handlePrimary}
          >
            {suggestion.action.label}
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
