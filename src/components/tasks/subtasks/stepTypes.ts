/** Pure checklist step-type helpers — safe to import from non-UI modules/tests. */

export type StepType =
  | "check"
  | "yes_no"
  | "text"
  | "number"
  | "photo"
  | "file"
  | "signature"
  | "scan"
  | "pass_fail"
  | "title"
  | "note"
  | "sub_step"
  | "divider";

export interface StepNote {
  text: string;
  created_at: string;
  created_by_name?: string;
  created_by_avatar?: string;
}

export interface SubtaskData {
  id: string;
  title: string;
  /** @deprecated Use step_type. Kept for DB / RPC compatibility. */
  is_yes_no: boolean;
  /** @deprecated Use step_type. Kept for DB / RPC compatibility. */
  requires_signature: boolean;
  /** UI-layer response/structure type. Indent is separate via `is_sub_step`. */
  step_type?: StepType;
  /**
   * Nesting / indent — orthogonal to response type.
   * A sub-step can still be yes/no, photo, signature, etc.
   */
  is_sub_step?: boolean;
  /** When true, a red asterisk is shown and completion is mandatory. */
  is_required?: boolean;
  /** When true, shows a follow-up branch indicator for failed checks. */
  has_followup_if_failed?: boolean;
  /** Org user ID pre-assigned to complete this step. */
  assigned_user_id?: string;
  /** Display name of the assigned user (denormalised for quick render). */
  assigned_user_name?: string;
  /** Inline annotation note attached to this step. */
  note?: StepNote;
  /** Follow-up step shown when this step is marked failed. */
  followup?: { title: string; step_type?: StepType };
  /** Completion state when executing a checklist on Task Detail. */
  is_completed?: boolean;
  /** Recorded compliance answer (yes/no, number, text, scan code, …). */
  response_value?: string | null;
  /** Structured response metadata. */
  response_json?: Record<string, unknown> | null;
  completed_by?: string | null;
  completed_at?: string | null;
  response_attachment_id?: string | null;
  signed_by?: string | null;
  signed_at?: string | null;
}

/** Whether this step is indented as a nested checklist item. */
export function resolveIsSubStep(step: Pick<SubtaskData, "is_sub_step" | "step_type">): boolean {
  if (typeof step.is_sub_step === "boolean") return step.is_sub_step;
  // Legacy: indent was stored as step_type === "sub_step"
  return step.step_type === "sub_step";
}

/** Resolve the effective response/structure type (never returns `sub_step`). */
export function getStepType(
  step: Pick<SubtaskData, "step_type" | "is_yes_no" | "requires_signature">
): StepType {
  if (step.step_type && step.step_type !== "sub_step") return step.step_type;
  if (step.step_type === "sub_step") return "check";
  if (step.is_yes_no) return "yes_no";
  if (step.requires_signature) return "signature";
  return "check";
}

/** Sync the legacy boolean fields from a step type (for DB compat). */
export function stepTypeToLegacy(
  type: StepType
): Pick<SubtaskData, "is_yes_no" | "requires_signature"> {
  return {
    is_yes_no: type === "yes_no",
    requires_signature: type === "signature",
  };
}

export const STEP_TYPES_ORDERED: StepType[] = [
  "check",
  "yes_no",
  "text",
  "number",
  "photo",
  "file",
  "signature",
  "scan",
  "pass_fail",
];
