/**
 * TaskChip - Unified chip renderer for Create Task and Task Details
 *
 * Single component handles both variants.
 * Maps ChipData to FactChipView or InteractiveChipView.
 */

import React from "react";
import { FactChipView } from "./FactChipView";
import { InteractiveChipView } from "./InteractiveChipView";
import type { ChipData } from "@/types/task-chip";

export interface TaskChipProps {
  chip: ChipData;
  onPress?: () => void;
  onRemove?: () => void;
}

export function TaskChip({ chip, onPress, onRemove }: TaskChipProps) {
  if (chip.variant === "fact") {
    return (
      <FactChipView
        label={chip.label}
        pending={chip.pending}
        onRemove={onRemove}
        onPress={onPress}
      />
    );
  }

  return (
    <InteractiveChipView
      label={chip.label}
      kind={chip.kind}
      blocking={chip.blocking}
      onPress={onPress ?? (() => {})}
    />
  );
}
