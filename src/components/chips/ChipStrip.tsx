/**
 * ChipStrip - Compact chip row for task sections
 *
 * Renders chips in contract order:
 * 1. Fact chips
 * 2. Interactive chips (blocking)
 * 3. Other interactive chips
 * 4. Instruction chip last
 *
 * Overflow: instruction first, then non-blocking interactive. Fact chips never removed.
 */

import React from "react";
import { cn } from "@/lib/utils";
import { TaskChip } from "./TaskChip";
import { sortChipsForStrip, applyOverflow } from "@/lib/task-chip-utils";
import type { ChipData } from "@/types/task-chip";

export interface ChipStripProps {
  chips: ChipData[];
  onChipPress?: (chip: ChipData) => void;
  onChipRemove?: (chip: ChipData) => void;
  maxVisible?: number;
  className?: string;
}

export function ChipStrip({
  chips,
  onChipPress,
  onChipRemove,
  maxVisible = 20,
  className,
}: ChipStripProps) {
  const sorted = React.useMemo(
    () => applyOverflow(sortChipsForStrip(chips), maxVisible),
    [chips, maxVisible]
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {sorted.map((chip) => (
        <TaskChip
          key={chip.id}
          chip={chip}
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
