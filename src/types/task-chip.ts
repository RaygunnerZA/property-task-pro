import type { ReactNode } from "react";

/**
 * Task Chip Contract - Two Variants Only
 *
 * Create Task panels/modals and Task Details panels/modals use:
 * - fact (resolved)
 * - interactive (instruction / suggestion / invite / shortcut / action / confirm / create)
 *
 * No ghost style. No third surface.
 * All interactive elements share one tactile language.
 */

export type SectionType =
  | "assignee"
  | "location"
  | "schedule"
  | "asset"
  | "priority"
  | "tags"
  | "compliance";

export type SectionVisualState =
  | "idle"
  | "hover"
  | "editing"
  | "selection"
  | "resolved"
  | "pending";

export type ChipVariant = "fact" | "interactive";

export type InteractiveKind =
  | "instruction"   // Add person or team
  | "suggestion"    // Invite Frank
  | "shortcut"      // TODAY
  | "action"        // Invite as Contractor
  | "confirm"       // SEND
  | "create";       // Add Boiler

export interface BaseChip {
  id: string;
  label: string;
  variant: ChipVariant;
}

export interface FactChip extends BaseChip {
  variant: "fact";
  pending?: boolean;
  entityId: string;
}

export interface InteractiveChip extends BaseChip {
  variant: "interactive";
  kind: InteractiveKind;
  blocking?: boolean;
}

export type ChipData = FactChip | InteractiveChip;

export interface TaskSectionState {
  visualState: SectionVisualState;
  chips: ChipData[];
}

export interface TaskSectionProps {
  type: SectionType;
  icon: ReactNode;
  state: TaskSectionState;
  onVisualStateChange: (state: SectionVisualState) => void;
  onChipPress: (chip: ChipData) => void;
}
