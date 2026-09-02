/**
 * Decision-oriented scan summary for Add Record.
 * Facts (outcome, issue, dates, findings) are shown as recorded information —
 * no selection controls. Only consequential actions (tasks / reminders) carry
 * checkboxes, behind an explicit "Create N tasks" confirmation.
 */

import { useState } from "react";
import { AlertTriangle, BadgeCheck, CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatIntakeDateDisplay } from "@/lib/intakeDocumentDates";
import type { AggregatedIntakeScanReview } from "@/lib/aggregateIntakeScanReview";

type Props = {
  review: AggregatedIntakeScanReview;
  selectedActionIds: Set<string>;
  onToggleAction: (id: string) => void;
  createTasks: boolean;
  onCreateTasksChange: (value: boolean) => void;
  className?: string;
};

export function IntakeComplianceScanReview({
  review,
  selectedActionIds,
  onToggleAction,
  createTasks,
  onCreateTasksChange,
  className,
}: Props) {
  const [findingsOpen, setFindingsOpen] = useState(false);

  const {
    outcome,
    outcomeSeverity,
    primaryIssue,
    dates,
    actions,
    failFindings,
    otherFindings,
  } = review;

  const hasContent =
    Boolean(outcome) ||
    dates.length > 0 ||
    actions.length > 0 ||
    failFindings.length > 0 ||
    otherFindings.length > 0;
  if (!hasContent) return null;

  const selectedCount = actions.filter((a) => selectedActionIds.has(a.id)).length;
  const secondaryFailFindings = failFindings.slice(1);
  const collapsedFindings = [...secondaryFailFindings, ...otherFindings];

  return (
    <div className={cn("space-y-3", className)}>
      {/* Outcome + primary issue — recorded facts */}
      {(outcome || primaryIssue) && (
        <div className="space-y-1">
          {outcome && (
            <div
              className={cn(
                "flex items-center gap-1.5 text-sm font-semibold",
                outcomeSeverity === "critical"
                  ? "text-destructive"
                  : outcomeSeverity === "ok"
                    ? "text-foreground"
                    : "text-foreground"
              )}
            >
              {outcomeSeverity === "critical" ? (
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              )}
              <span>{outcome}</span>
            </div>
          )}
          {primaryIssue && (
            <p className="text-xs leading-snug text-foreground">{primaryIssue}</p>
          )}
        </div>
      )}

      {/* Key dates — passive, labelled, urgency-ordered */}
      {dates.length > 0 && (
        <div className="space-y-1">
          {dates.slice(0, 4).map((item) => {
            const isDeadline = item.kind === "action_deadline";
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  isDeadline ? "font-semibold text-destructive" : "text-muted-foreground"
                )}
              >
                <CalendarDays
                  className={cn("h-3.5 w-3.5 shrink-0", isDeadline ? "" : "text-primary")}
                  aria-hidden
                />
                <span>
                  {item.label} {formatIntakeDateDisplay(item.date)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Recommended actions — the only selectable rows */}
      {actions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Filla recommends</Label>
          <ul className="space-y-1.5">
            {actions.map((action) => {
              const checked = selectedActionIds.has(action.id);
              return (
                <li key={action.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-background/60 px-2.5 py-2 text-xs shadow-e1">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-input"
                      checked={checked}
                      onChange={() => onToggleAction(action.id)}
                    />
                    <span className="min-w-0 flex-1 leading-snug text-foreground">
                      {action.text}
                      {action.immediate ? (
                        <span className="ml-1 font-semibold text-destructive">— Immediate</span>
                      ) : action.deadline && action.kind === "action" ? (
                        <span className="ml-1 text-muted-foreground">
                          — Due {formatIntakeDateDisplay(action.deadline)}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={createTasks && selectedCount > 0}
              disabled={selectedCount === 0}
              onChange={(e) => onCreateTasksChange(e.target.checked)}
              className="rounded border-input"
            />
            <span>
              Create {selectedCount} task{selectedCount === 1 ? "" : "s"}
            </span>
          </label>
        </div>
      )}

      {/* Additional findings — recorded, collapsed by default */}
      {collapsedFindings.length > 0 && (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setFindingsOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {findingsOpen ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            )}
            {collapsedFindings.length} other finding{collapsedFindings.length === 1 ? "" : "s"}
          </button>
          {findingsOpen && (
            <ul className="space-y-1 pl-4">
              {collapsedFindings.map((finding) => (
                <li
                  key={finding.id}
                  className={cn(
                    "text-xs leading-snug",
                    finding.status === "fail" ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {finding.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
