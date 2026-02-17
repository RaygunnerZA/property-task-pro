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
  className?: string;
}

export function SemanticChipStrip({
  chips,
  onChipPress,
  onChipRemove,
  maxVisible = 20,
  size = "default",
  className,
}: SemanticChipStripProps) {
  const sorted = React.useMemo(
    () => applyOverflow(sortChipsForStrip(chips), maxVisible),
    [chips, maxVisible]
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {sorted.map((chip) => (
        <SemanticChip
          key={chip.id}
          epistemic={chip.variant === "fact" ? "fact" : "proposal"}
          label={chip.label}
          size={size}
          removable={chip.variant === "fact" && !!onChipRemove}
          pending={chip.variant === "fact" && "pending" in chip && chip.pending}
          onPress={onChipPress ? () => onChipPress(chip) : undefined}
          onRemove={
            chip.variant === "fact" && onChipRemove
              ? () => onChipRemove(chip)
              : undefined
          }
        />
      ))}
    </div>
  );
}
