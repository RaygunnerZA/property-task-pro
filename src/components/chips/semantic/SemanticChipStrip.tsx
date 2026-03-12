/**
 * SemanticChipStrip - Chip row for task sections using SemanticChip.
 *
 * Renders chips in contract order:
 * 1. Fact chips
 * 2. Interactive chips (blocking)
 * 3. Other interactive chips
 * 4. Instruction chip last
 *
 * Maps ChipData variant to epistemic: fact → fact, interactive → proposal.
 */

import React from "react";
import { cn } from "@/lib/utils";
import { SemanticChip } from "./SemanticChip";
import { sortChipsForStrip, applyOverflow } from "@/lib/task-chip-utils";
import type { ChipData } from "@/types/task-chip";

export interface SemanticChipStripProps {
  chips: ChipData[];
  onChipPress?: (chip: ChipData) => void;
  onChipRemove?: (chip: ChipData) => void;
  maxVisible?: number;
  size?: "default" | "compact";
  /** When true, all chips use natural width (no truncation). */
  noTruncate?: boolean;
  className?: string;
}

export function SemanticChipStrip({
  chips,
  onChipPress,
  onChipRemove,
  maxVisible = 20,
  size = "default",
  noTruncate = false,
  className,
}: SemanticChipStripProps) {
  const sorted = React.useMemo(
    () => applyOverflow(sortChipsForStrip(chips), maxVisible),
    [chips, maxVisible]
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-nowrap whitespace-nowrap min-w-0 no-scrollbar pr-[6px] pt-[3px] pb-[3px]",
        className
      )}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {sorted.map((chip) => {
        const isValueChip = "kind" in chip && chip.kind === "instruction";
        return (
          <SemanticChip
            key={chip.id}
            epistemic={chip.variant === "fact" ? "fact" : "proposal"}
            label={chip.label}
            size={size}
            truncate={!isValueChip}
            removable={chip.variant === "fact" && !!onChipRemove}
            pending={chip.variant === "fact" && "pending" in chip && chip.pending}
            onPress={onChipPress ? () => onChipPress(chip) : undefined}
            onRemove={
              chip.variant === "fact" && onChipRemove
                ? () => onChipRemove(chip)
                : undefined
            }
            className={isValueChip ? "px-2.5 py-1.5 bg-background shadow-e1 max-w-none min-w-0" : undefined}
          />
        );
      })}
    </div>
  );
}
