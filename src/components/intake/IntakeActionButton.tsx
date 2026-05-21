import type { ButtonHTMLAttributes, ReactNode } from "react";
import { FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INTAKE_ADD_RECORD_LABEL,
  INTAKE_REPORT_ISSUE_LABEL,
  intakeAddRecordButtonClassName,
  intakeAddRecordCompactClassName,
  intakeAddRecordIconClassName,
  intakeAddRecordMicroClassName,
  intakeAddRecordStackedClassName,
  intakeFabSatelliteAddClassName,
  intakeReportIssueButtonClassName,
  intakeReportIssueCompactClassName,
  intakeReportIssueIconClassName,
  intakeReportIssueMicroClassName,
  intakeReportIssueStackedClassName,
  intakeFabSatelliteReportClassName,
} from "@/lib/intake-action-buttons";
import type { IntakeMode } from "@/types/intake";

export type IntakeActionButtonVariant = "toolbar" | "micro" | "compact" | "stacked" | "fab";

const variantClassName: Record<IntakeMode, Record<IntakeActionButtonVariant, string>> = {
  add_record: {
    toolbar: intakeAddRecordButtonClassName,
    micro: intakeAddRecordMicroClassName,
    compact: intakeAddRecordCompactClassName,
    stacked: intakeAddRecordStackedClassName,
    fab: intakeFabSatelliteAddClassName,
  },
  report_issue: {
    toolbar: intakeReportIssueButtonClassName,
    micro: intakeReportIssueMicroClassName,
    compact: intakeReportIssueCompactClassName,
    stacked: intakeReportIssueStackedClassName,
    fab: intakeFabSatelliteReportClassName,
  },
};

const defaultLabels: Record<IntakeMode, string> = {
  add_record: INTAKE_ADD_RECORD_LABEL,
  report_issue: INTAKE_REPORT_ISSUE_LABEL,
};

export type IntakeActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  mode: IntakeMode;
  variant?: IntakeActionButtonVariant;
  showIcon?: boolean;
  showLabel?: boolean;
  children?: ReactNode;
};

export function IntakeActionButton({
  mode,
  variant = "micro",
  showIcon = true,
  showLabel = true,
  className,
  children,
  type = "button",
  ...props
}: IntakeActionButtonProps) {
  const Icon = mode === "add_record" ? FileText : Plus;
  const iconClassName = mode === "add_record" ? intakeAddRecordIconClassName : intakeReportIssueIconClassName;
  const label = children ?? defaultLabels[mode];

  return (
    <button
      type={type}
      className={cn(variantClassName[mode][variant], className)}
      {...props}
    >
      {showIcon ? <Icon className={iconClassName} aria-hidden /> : null}
      {showLabel ? label : null}
    </button>
  );
}

export type IntakeActionButtonPairProps = {
  variant?: IntakeActionButtonVariant;
  /** `row` = flex wrap (cards, panels). `grid` = participate in parent grid (toolbars). */
  layout?: "row" | "grid";
  className?: string;
  onAddRecord?: () => void;
  onReportIssue?: () => void;
  addRecordDisabled?: boolean;
  reportIssueDisabled?: boolean;
};

/** Side-by-side Add Record + Report Issue — same order and styling everywhere. */
export function IntakeActionButtonPair({
  variant = "micro",
  layout = "row",
  className,
  onAddRecord,
  onReportIssue,
  addRecordDisabled,
  reportIssueDisabled,
}: IntakeActionButtonPairProps) {
  return (
    <div
      className={cn(
        layout === "grid" ? "contents [&>button]:h-full" : "flex flex-wrap gap-2",
        className
      )}
    >
      <IntakeActionButton mode="add_record" variant={variant} onClick={onAddRecord} disabled={addRecordDisabled} />
      <IntakeActionButton mode="report_issue" variant={variant} onClick={onReportIssue} disabled={reportIssueDisabled} />
    </div>
  );
}
