import type { StepType } from "@/components/tasks/subtasks/stepTypes";

/** Payload submitted when an assignee completes a checklist step. */
export type ChecklistStepResponseInput = {
  /** Canonical recorded value: yes|no|pass|fail|text|number|scan code|signed */
  value: string;
  /** Extra compliance metadata (units, filename, geo, barcode format, etc.). */
  metadata?: Record<string, unknown>;
  /** Optional evidence file (photo / document). */
  file?: File;
  /** Signature as PNG data URL from the pad. */
  signatureDataUrl?: string;
};

export type ChecklistStepResponseRecord = {
  response_value: string | null;
  response_json: Record<string, unknown>;
  completed_by: string | null;
  completed_at: string | null;
  response_attachment_id: string | null;
  signed_by: string | null;
  signed_at: string | null;
  is_completed: boolean;
  completed: boolean;
};

export function responseLabelForType(stepType: StepType, value: string | null | undefined): string {
  if (!value) return "";
  switch (stepType) {
    case "yes_no":
      return value === "yes" ? "Yes" : value === "no" ? "No" : value;
    case "pass_fail":
      return value === "pass" ? "Pass" : value === "fail" ? "Fail" : value;
    case "signature":
      return "Signed";
    default:
      return value;
  }
}

export function isStepResponseComplete(
  stepType: StepType,
  record: Partial<ChecklistStepResponseRecord> | null | undefined
): boolean {
  if (!record) return false;
  if (stepType === "title" || stepType === "note" || stepType === "divider") {
    return true;
  }
  if (stepType === "check") {
    return Boolean(record.is_completed || record.completed);
  }
  if (stepType === "signature") {
    return Boolean(record.signed_at && record.signed_by) || Boolean(record.response_value);
  }
  if (stepType === "photo" || stepType === "file") {
    return Boolean(record.response_attachment_id) || Boolean(record.response_value);
  }
  return Boolean(record.response_value);
}
