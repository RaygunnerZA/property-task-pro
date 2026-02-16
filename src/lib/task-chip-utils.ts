/**
 * Task Chip Utilities
 *
 * - sortChipsForStrip: Priority order per contract
 * - hasBlockingChips: Submit validation
 * - suggestedChipToChipData: Adapter from SuggestedChip to ChipData
 */

import type { ChipData, InteractiveKind } from "@/types/task-chip";
import type { SuggestedChip } from "@/types/chip-suggestions";

/** Section ordering: 1. Fact, 2. Blocking interactive, 3. Other interactive, 4. Instruction last */
export function sortChipsForStrip(chips: ChipData[]): ChipData[] {
  const facts = chips.filter((c): c is ChipData & { variant: "fact" } => c.variant === "fact");
  const interactive = chips.filter((c): c is ChipData & { variant: "interactive" } => c.variant === "interactive");
  const blocking = interactive.filter((c) => c.blocking);
  const nonBlocking = interactive.filter((c) => !c.blocking);
  const instruction = nonBlocking.filter((c) => c.kind === "instruction");
  const other = nonBlocking.filter((c) => c.kind !== "instruction");

  return [...facts, ...blocking, ...other, ...instruction];
}

/** Overflow: remove instruction first, then non-blocking interactive. Fact chips never removed. */
export function applyOverflow(chips: ChipData[], maxVisible: number): ChipData[] {
  const sorted = sortChipsForStrip(chips);
  if (sorted.length <= maxVisible) return sorted;

  let remaining = sorted.length;
  const result = [...sorted];

  // Remove instruction chips first
  for (let i = result.length - 1; i >= 0 && remaining > maxVisible; i--) {
    const c = result[i];
    if (c.variant === "interactive" && c.kind === "instruction") {
      result.splice(i, 1);
      remaining--;
    }
  }

  // Then non-blocking interactive
  for (let i = result.length - 1; i >= 0 && remaining > maxVisible; i--) {
    const c = result[i];
    if (c.variant === "interactive" && !c.blocking) {
      result.splice(i, 1);
      remaining--;
    }
  }

  return result;
}

/** Submit disabled if any section has blocking interactive chips */
export function hasBlockingChips(
  sections: Record<string, { chips: ChipData[] }>
): boolean {
  return Object.values(sections).some((section) =>
    section.chips.some(
      (chip) => chip.variant === "interactive" && chip.blocking
    )
  );
}

/** Map SuggestedChip to ChipData for backward compatibility */
export function suggestedChipToChipData(
  chip: SuggestedChip,
  options?: {
    verbLabel?: string;
    kind?: InteractiveKind;
  }
): ChipData {
  const isResolved = !!chip.resolvedEntityId;
  const isBlocking = !!chip.blockingRequired && !chip.resolvedEntityId;

  if (isResolved) {
    return {
      id: chip.id,
      label: chip.label.toUpperCase(),
      variant: "fact",
      entityId: chip.resolvedEntityId!,
      pending: chip.state === "suggested" || chip.state === "blocked",
    };
  }

  const label = options?.verbLabel ?? chip.label.toUpperCase();
  const kind = options?.kind ?? inferInteractiveKind(chip);

  return {
    id: chip.id,
    label,
    variant: "interactive",
    kind,
    blocking: isBlocking,
  };
}

function inferInteractiveKind(chip: SuggestedChip): InteractiveKind {
  if (chip.blockingRequired && !chip.resolvedEntityId) {
    if (chip.type === "person") return "suggestion"; // Invite Frank
    if (chip.type === "space" || chip.type === "asset") return "create"; // Add Boiler
    if (chip.type === "date") return "shortcut"; // TODAY
    return "action";
  }
  return "suggestion";
}
