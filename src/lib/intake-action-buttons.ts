/**
 * Canonical FILLA intake CTA styling:
 * Create Task = turquoise (#8EC9CE / primary), Add Record = orange (coral accent).
 */
import { cn } from "@/lib/utils";

const createTaskBg = "bg-primary";
const addRecordBg = "bg-[hsl(16_82%_56%)]"; // coral-orange for Add Record
const onCta = "text-white";

/** Raised control shadow — matches TaskPanel active tab pill (dual light + depth). */
const toolbarRaisedShadow =
  "shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]";

const createNeuShadow =
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.12),inset_1px_1px_2px_0px_rgba(255,255,255,0.35)]";
const addNeuShadow =
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,0.4)]";
const addNeuShadowSoft =
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.1),inset_1px_1px_2px_0px_rgba(255,255,255,0.35)]";

export const intakeReportIssueButtonClassName = cn(
  "flex h-full min-h-0 min-w-0 w-full items-center justify-center gap-2 whitespace-nowrap rounded-card border-0 px-3 py-0 text-sm font-medium leading-none",
  "lg:h-9 lg:min-h-9 lg:max-h-9 lg:py-0 lg:flex-1",
  onCta,
  createTaskBg,
  toolbarRaisedShadow,
  "transition-all hover:bg-primary/90",
  "lg:justify-start lg:px-1.5 lg:gap-[5px]"
);

export const intakeAddRecordButtonClassName = cn(
  "flex h-full min-h-0 min-w-0 w-full items-center justify-center gap-2 whitespace-nowrap rounded-card border-0 px-3 py-0 text-sm font-medium leading-none",
  "lg:h-9 lg:min-h-9 lg:max-h-9 lg:py-0 lg:flex-1",
  onCta,
  addRecordBg,
  toolbarRaisedShadow,
  "transition-all hover:brightness-95",
  "lg:justify-start lg:px-1.5 lg:gap-[5px]"
);

export const intakeReportIssueIconClassName = "h-4 w-4 shrink-0 text-white";
export const intakeAddRecordIconClassName = "h-4 w-4 shrink-0 text-white";

/** Narrow sidebar quick actions (workbench / Issues column) */
export const intakeReportIssueCompactClassName = cn(
  "flex h-auto w-[85px] items-center justify-start gap-2 rounded-card border-0 px-2 py-1 text-left text-xs font-semibold text-white",
  createTaskBg,
  createNeuShadow,
  "transition-all hover:bg-primary/90"
);

export const intakeAddRecordCompactClassName = cn(
  "flex h-auto w-[85px] items-center justify-start gap-1 rounded-card border-0 px-2 py-1 text-left text-xs font-semibold text-white",
  addRecordBg,
  addNeuShadow,
  "transition-all hover:brightness-95"
);

/** Left sidebar concertina list rows */
export const intakeReportIssueListRowClassName = cn(
  "w-full flex items-center gap-2 rounded-md border-0 px-2.5 py-2 text-left text-sm font-semibold text-white",
  createTaskBg,
  createNeuShadow,
  "transition-all hover:bg-primary/90"
);

export const intakeAddRecordListRowClassName = cn(
  "w-full flex items-center gap-2 rounded-md border-0 px-2.5 py-2 text-left text-sm font-semibold text-white",
  addRecordBg,
  addNeuShadowSoft,
  "transition-all hover:brightness-95"
);

export const intakeListRowReportIconClassName = "h-4 w-4 shrink-0 text-white";
export const intakeListRowAddIconClassName = "h-4 w-4 shrink-0 text-white";

/** Mobile create drawer — large tap targets */
export const intakeReportIssueDrawerCardClassName = cn(
  "w-full rounded-lg border-0 p-4 text-left transition-all text-white",
  createTaskBg,
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.12),inset_1px_1px_2px_0px_rgba(255,255,255,0.35)] hover:bg-primary/90"
);

export const intakeAddRecordDrawerCardClassName = cn(
  "w-full rounded-lg border-0 p-4 text-left transition-all text-white",
  addRecordBg,
  addNeuShadow,
  "hover:brightness-95"
);

export const intakeDrawerIconWrapReportClassName = "p-2 rounded-lg bg-white/20";
export const intakeDrawerIconWrapAddClassName = "p-2 rounded-lg bg-white/20";

/** Expanded mobile FAB satellites */
export const intakeFabSatelliteReportClassName = cn(
  "w-12 h-12 rounded-full border-0 flex items-center justify-center transition-transform active:scale-95 text-white",
  createTaskBg,
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,0.35)] hover:translate-y-[-2px]"
);

export const intakeFabSatelliteAddClassName = cn(
  "w-12 h-12 rounded-full border-0 flex items-center justify-center transition-transform active:scale-95 text-white",
  addRecordBg,
  "shadow-[1px_3px_4px_0px_rgba(0,0,0,0.1),inset_1px_1px_1px_rgba(255,255,255,0.4)] hover:translate-y-[-2px]"
);

/** Inline / compliance card footers */
export const intakeReportIssueMicroClassName = cn(
  "inline-flex items-center justify-center gap-1 rounded-card border-0 px-2 py-1 text-caption font-semibold leading-none text-white",
  createTaskBg,
  "shadow-e1 transition-all hover:shadow-md hover:bg-primary/90"
);

export const intakeAddRecordMicroClassName = cn(
  "inline-flex items-center justify-center gap-1 rounded-card border-0 px-2 py-1 text-caption font-semibold leading-none text-white",
  addRecordBg,
  "shadow-e1 transition-all hover:shadow-md hover:brightness-95"
);

/** Intake modal/column footer primary — Create Task = turquoise. */
export const intakeFooterSubmitReportIssueClassName = cn(
  createTaskBg,
  onCta,
  createNeuShadow,
  "hover:bg-primary/90 hover:text-white"
);

/** Intake modal/column footer primary when saving compliance / Add Record path. */
export const intakeFooterSubmitAddRecordClassName = cn(
  addRecordBg,
  onCta,
  addNeuShadow,
  "hover:brightness-95 hover:text-white"
);

/** Full-width stacked actions (records rail, property workspace cards). */
export const intakeAddRecordStackedClassName = cn(
  "w-full flex items-center justify-center gap-2 rounded-xl border-0 px-4 py-2.5 text-sm font-semibold",
  onCta,
  addRecordBg,
  addNeuShadow,
  "transition-all hover:brightness-95"
);

export const intakeReportIssueStackedClassName = cn(
  "w-full flex items-center justify-center gap-2 rounded-xl border-0 px-4 py-2.5 text-sm font-semibold",
  onCta,
  createTaskBg,
  createNeuShadow,
  "transition-all hover:bg-primary/90"
);

export const INTAKE_ADD_RECORD_LABEL = "Add Record";
/** Task-creation path (mode `report_issue`) — product label is Create Task. */
export const INTAKE_REPORT_ISSUE_LABEL = "Create Task";
export const INTAKE_CREATE_TASK_LABEL = INTAKE_REPORT_ISSUE_LABEL;
