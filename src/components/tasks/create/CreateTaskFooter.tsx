/**
 * CreateTaskFooter
 *
 * Renders the sticky footer of CreateTaskModal:
 * ClarityState banner + Cancel / Create Task buttons.
 *
 * Pure presentational. Extracted from CreateTaskModal.tsx (Tier 3 — gap-modal-size).
 */

import { Button } from "@/components/ui/button";
import { ClarityState } from "./ClarityState";
import type { SuggestedChip } from "@/types/chip-suggestions";
import { cn } from "@/lib/utils";

export interface CreateTaskFooterProps {
  clarityState: { severity: "blocking" | "warning"; message: string } | null;
  verbChips: SuggestedChip[];
  isSubmitting: boolean;
  shouldShowDetailsArea: boolean;
  handleSubmit: () => void;
  onCancel: () => void;
}

export function CreateTaskFooter({
  clarityState,
  verbChips,
  isSubmitting,
  shouldShowDetailsArea,
  handleSubmit,
  onCancel,
}: CreateTaskFooterProps) {
  return (
    <div
      aria-hidden={!shouldShowDetailsArea}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-500 ease-out",
        shouldShowDetailsArea
          ? "grid-rows-[1fr] opacity-100"
          : "grid-rows-[0fr] opacity-0 pointer-events-none"
      )}
    >
      <div className="overflow-hidden">
        <div className="flex flex-col gap-3 border-t border-transparent bg-transparent backdrop-blur text-foreground px-4 pt-[6px] pb-6">
          {clarityState && (
            <ClarityState severity={clarityState.severity} message={clarityState.message} />
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 shadow-e1"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 shadow-primary-btn"
              onClick={handleSubmit}
              disabled={isSubmitting || clarityState?.severity === "blocking" || verbChips.length > 0}
              title={clarityState?.severity === "blocking" ? clarityState.message : undefined}
            >
              {isSubmitting ? "Creating…" : "Create Task"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
