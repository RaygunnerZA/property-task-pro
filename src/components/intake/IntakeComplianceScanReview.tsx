/**
 * Multi-date checklist + next steps for Add Record after document scan.
 */

import { CalendarDays, ListChecks } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  formatIntakeDateDisplay,
  type IntakeImportantDate,
  type IntakeScanNextStep,
} from "@/lib/intakeDocumentDates";

type Props = {
  dates: IntakeImportantDate[];
  selectedDateIds: Set<string>;
  onToggleDate: (id: string) => void;
  nextSteps: IntakeScanNextStep[];
  selectedStepIds: Set<string>;
  onToggleStep: (id: string) => void;
  createReminders: boolean;
  onCreateRemindersChange: (value: boolean) => void;
  /** Contextual CTA label, e.g. Create reminders / Create follow-up tasks */
  remindersLabel?: string;
  className?: string;
};

export function IntakeComplianceScanReview({
  dates,
  selectedDateIds,
  onToggleDate,
  nextSteps,
  selectedStepIds,
  onToggleStep,
  createReminders,
  onCreateRemindersChange,
  remindersLabel = "Create reminders",
  className,
}: Props) {
  if (dates.length === 0 && nextSteps.length === 0) return null;

  const selectedCount = [...selectedDateIds].filter((id) =>
    dates.some((d) => d.id === id)
  ).length;
  const selectedSteps = [...selectedStepIds].filter((id) =>
    nextSteps.some((s) => s.id === id)
  ).length;

  return (
    <div className={cn("space-y-3", className)}>
      {dates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-primary" aria-hidden />
            <Label className="text-xs text-muted-foreground">
              Dates found{dates.length > 1 ? ` (${dates.length})` : ""}
            </Label>
          </div>
          <ul className="space-y-1.5">
            {dates.map((item) => {
              const checked = selectedDateIds.has(item.id);
              return (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-background/60 px-2.5 py-2 text-xs shadow-e1">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-input"
                      checked={checked}
                      onChange={() => onToggleDate(item.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{item.label}</span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {formatIntakeDateDisplay(item.date)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {nextSteps.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5 text-primary" aria-hidden />
            <Label className="text-xs text-muted-foreground">
              Suggested next steps{nextSteps.length > 1 ? ` (${nextSteps.length})` : ""}
            </Label>
          </div>
          <ul className="space-y-1.5">
            {nextSteps.map((step) => {
              const checked = selectedStepIds.has(step.id);
              return (
                <li key={step.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-background/60 px-2.5 py-2 text-xs shadow-e1">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-input"
                      checked={checked}
                      onChange={() => onToggleStep(step.id)}
                    />
                    <span className="min-w-0 flex-1 text-foreground leading-snug">{step.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(dates.length > 0 || nextSteps.length > 0) && (
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={createReminders}
            onChange={(e) => onCreateRemindersChange(e.target.checked)}
            className="rounded border-input"
          />
          <span>
            {remindersLabel}
            {createReminders && (selectedCount > 0 || selectedSteps > 0)
              ? ` (${selectedCount + (selectedSteps > 0 ? 1 : 0)})`
              : ""}
          </span>
        </label>
      )}
    </div>
  );
}
