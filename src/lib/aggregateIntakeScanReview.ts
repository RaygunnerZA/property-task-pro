/**
 * Aggregate per-file scan results for the Add Record compliance review UI.
 */

import {
  mergeImportantDates,
  type IntakeImportantDate,
  type IntakeScanNextStep,
} from "@/lib/intakeDocumentDates";
import type { PendingIntakeFile } from "@/utils/ingestIntakeMediaFiles";

export type AggregatedIntakeScanReview = {
  dates: IntakeImportantDate[];
  nextSteps: IntakeScanNextStep[];
  remindersLabel: string;
  fileCountWithScan: number;
};

export function aggregateIntakeScanReview(
  files: PendingIntakeFile[]
): AggregatedIntakeScanReview {
  const scanned = files.filter((f) => f.scanStatus === "done");
  const dates = mergeImportantDates(
    [],
    scanned.flatMap((f) =>
      (f.scanImportantDates ?? []).map((d) => ({
        ...d,
        id: `${f.local_id}:${d.id}`,
        label:
          scanned.length > 1
            ? `${d.label} · ${(f.scanTitle || f.display_name).slice(0, 40)}`
            : d.label,
      }))
    )
  );

  const seenSteps = new Set<string>();
  const nextSteps: IntakeScanNextStep[] = [];
  for (const file of scanned) {
    for (const step of file.scanNextSteps ?? []) {
      const key = step.text.toLowerCase();
      if (seenSteps.has(key)) continue;
      seenSteps.add(key);
      nextSteps.push({
        ...step,
        id: `${file.local_id}:${step.id}`,
        text:
          scanned.length > 1
            ? `${step.text} (${(file.scanTitle || file.display_name).slice(0, 36)})`
            : step.text,
      });
      if (nextSteps.length >= 10) break;
    }
    if (nextSteps.length >= 10) break;
  }

  const hasCritical = scanned.some(
    (f) => f.scanOutcome && /unsatisfactory|fail|action_required|high/i.test(f.scanOutcome)
  );
  const remindersLabel = hasCritical
    ? "Create follow-up tasks"
    : dates.some((d) => d.remindByDefault)
      ? "Create reminders"
      : nextSteps.length > 0
        ? "Create follow-up tasks"
        : "Create reminders";

  return {
    dates,
    nextSteps,
    remindersLabel,
    fileCountWithScan: scanned.length,
  };
}
