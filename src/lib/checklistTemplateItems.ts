import {
  getStepType,
  resolveIsSubStep,
  stepTypeToLegacy,
  type StepType,
  type SubtaskData,
} from "@/components/tasks/subtasks/stepTypes";

/** JSONB shape stored on `checklist_templates.items`. */
export type ChecklistTemplateItemJson = {
  title: string;
  /** Rich response / structure type used by the checklist editor. */
  step_type: StepType;
  /** Nested / indented under the previous step. */
  is_sub_step?: boolean;
  /** Mandatory completion marker in the editor. */
  is_required?: boolean;
  /** Legacy columns — kept for older readers / RPC paths. */
  is_yes_no: boolean;
  requires_signature: boolean;
};

function isStepType(value: unknown): value is StepType {
  return (
    typeof value === "string" &&
    [
      "check",
      "yes_no",
      "text",
      "number",
      "photo",
      "file",
      "signature",
      "scan",
      "pass_fail",
      "title",
      "note",
      "sub_step",
      "divider",
    ].includes(value)
  );
}

function shouldKeepTemplateItem(title: string, stepType: StepType): boolean {
  if (title.length > 0) return true;
  // Structural rows may be blank in the editor.
  return stepType === "divider" || stepType === "note" || stepType === "title";
}

/** Serialize editor checklist rows into template JSONB items. */
export function serializeChecklistTemplateItems(
  items: Array<Pick<SubtaskData, "title" | "is_yes_no" | "requires_signature" | "step_type" | "is_sub_step" | "is_required">>
): ChecklistTemplateItemJson[] {
  return items
    .map((item) => {
      const title = item.title.trim();
      const stepType = getStepType(item);
      const legacy = stepTypeToLegacy(stepType);
      if (!shouldKeepTemplateItem(title, stepType)) return null;
      return {
        title,
        step_type: stepType,
        is_sub_step: resolveIsSubStep(item),
        is_required: Boolean(item.is_required),
        is_yes_no: legacy.is_yes_no,
        requires_signature: legacy.requires_signature,
      } satisfies ChecklistTemplateItemJson;
    })
    .filter((item): item is ChecklistTemplateItemJson => item !== null);
}

/** Restore editor checklist rows from template JSONB (or legacy string items). */
export function parseChecklistTemplateItems(rawItems: unknown): SubtaskData[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((item): SubtaskData | null => {
      if (typeof item === "string") {
        const title = item.trim();
        if (!title) return null;
        return {
          id: crypto.randomUUID(),
          title,
          is_yes_no: false,
          requires_signature: false,
          step_type: "check",
          is_sub_step: false,
          is_required: false,
        };
      }

      if (!item || typeof item !== "object") return null;

      const candidate = item as Record<string, unknown>;
      const title = String(candidate.title ?? candidate.label ?? "").trim();
      const legacyYesNo = Boolean(candidate.is_yes_no);
      const legacySignature = Boolean(candidate.requires_signature);
      const storedType = isStepType(candidate.step_type) ? candidate.step_type : undefined;

      // Prefer explicit step_type; fall back to legacy booleans (never force "check" over them).
      const stepType: StepType =
        storedType && storedType !== "sub_step"
          ? storedType
          : legacyYesNo
            ? "yes_no"
            : legacySignature
              ? "signature"
              : storedType === "sub_step"
                ? "check"
                : "check";

      const legacy = stepTypeToLegacy(stepType);
      const isSubStep =
        typeof candidate.is_sub_step === "boolean"
          ? candidate.is_sub_step
          : storedType === "sub_step";

      if (!shouldKeepTemplateItem(title, stepType)) return null;

      return {
        id: crypto.randomUUID(),
        title,
        step_type: stepType,
        is_sub_step: isSubStep,
        is_required: Boolean(candidate.is_required),
        is_yes_no: legacy.is_yes_no,
        requires_signature: legacy.requires_signature,
      };
    })
    .filter((item): item is SubtaskData => item !== null);
}
