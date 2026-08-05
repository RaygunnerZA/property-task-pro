import {
  getStepType,
  resolveIsSubStep,
  stepTypeToLegacy,
  type StepType,
  type SubtaskData,
} from "@/components/tasks/subtasks/stepTypes";

/** Fields written to `public.subtasks` for a checklist step. */
export type SubtaskPersistFields = {
  title: string;
  step_type: StepType;
  is_sub_step: boolean;
  is_required: boolean;
  is_yes_no: boolean;
  requires_signature: boolean;
  order_index: number;
  is_completed: boolean;
  completed: boolean;
  is_archived: boolean;
};

export function buildSubtaskPersistFields(
  step: Pick<
    SubtaskData,
    "title" | "step_type" | "is_yes_no" | "requires_signature" | "is_sub_step" | "is_required"
  >,
  orderIndex: number
): SubtaskPersistFields {
  const stepType = getStepType(step);
  const legacy = stepTypeToLegacy(stepType);
  return {
    title: step.title.trim(),
    step_type: stepType,
    is_sub_step: resolveIsSubStep(step),
    is_required: Boolean(step.is_required),
    is_yes_no: legacy.is_yes_no,
    requires_signature: legacy.requires_signature,
    order_index: orderIndex,
    is_completed: false,
    completed: false,
    is_archived: false,
  };
}

export function rowToChecklistItem(row: {
  id: string;
  title?: string | null;
  is_yes_no?: boolean | null;
  requires_signature?: boolean | null;
  step_type?: string | null;
  is_sub_step?: boolean | null;
  is_required?: boolean | null;
  is_completed?: boolean | null;
  completed?: boolean | null;
}): SubtaskData {
  const legacyYesNo = Boolean(row.is_yes_no);
  const legacySignature = Boolean(row.requires_signature);
  const stored = row.step_type;
  const stepType: StepType =
    stored && stored !== "sub_step"
      ? (stored as StepType)
      : legacyYesNo
        ? "yes_no"
        : legacySignature
          ? "signature"
          : "check";
  const legacy = stepTypeToLegacy(stepType);
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    step_type: stepType,
    is_sub_step: Boolean(row.is_sub_step) || stored === "sub_step",
    is_required: Boolean(row.is_required),
    is_yes_no: legacy.is_yes_no,
    requires_signature: legacy.requires_signature,
    is_completed: Boolean(row.is_completed || row.completed),
  };
}
