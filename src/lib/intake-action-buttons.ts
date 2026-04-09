import { cn } from "@/lib/utils";

/**
 * Canonical FILLA intake CTA styling:
 * Report Issue = #ff6b6b, Add Record = #8DC9CE; label and icons use white on both.
 */
const reportBg = "bg-[#ff6b6b]";
const addRecordBg = "bg-[#8DC9CE]";
const onCta = "text-white";

/** Raised control shadow — matches TaskPanel active tab pill (dual light + depth). */
const toolbarRaisedShadow =
  "shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]";

const reportNeuShadow =
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,0.4)]";
const reportNeuShadowSoft =
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.1),inset_1px_1px_2px_0px_rgba(255,255,255,0.35)]";
const addNeuShadow =
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.12),inset_1px_1px_2px_0px_rgba(255,255,255,0.35)]";

export const intakeReportIssueButtonClassName = cn(
  "flex h-full min-h-0 min-w-0 w-full items-center justify-center gap-2 whitespace-nowrap rounded-[8px] border-0 px-3 py-0 text-sm font-medium leading-none",
  "lg:h-auto lg:min-h-[40px] lg:py-2",
  onCta,
  reportBg,
  toolbarRaisedShadow,
  "transition-all hover:bg-[#ff6b6b]/90",
  "lg:justify-start lg:px-2.5"
);

export const intakeAddRecordButtonClassName = cn(
  "flex h-full min-h-0 min-w-0 w-full items-center justify-center gap-2 whitespace-nowrap rounded-[8px] border-0 px-3 py-0 text-sm font-medium leading-none",
  "lg:h-auto lg:min-h-[40px] lg:py-2",
  onCta,
  addRecordBg,
  toolbarRaisedShadow,
  "transition-all hover:bg-[#8DC9CE]/90",
  "lg:justify-start lg:px-2.5"
);

export const intakeReportIssueIconClassName = "h-4 w-4 shrink-0 text-white";
export const intakeAddRecordIconClassName = "h-4 w-4 shrink-0 text-white";

/** Narrow sidebar quick actions (workbench / Issues column) */
export const intakeReportIssueCompactClassName = cn(
  "flex h-auto w-[85px] items-center justify-start gap-2 rounded-[8px] border-0 px-2 py-1 text-left text-xs font-semibold text-white",
  reportBg,
  reportNeuShadow,
  "transition-all hover:bg-[#ff6b6b]/90"
);

export const intakeAddRecordCompactClassName = cn(
  "flex h-auto w-[85px] items-center justify-start gap-1 rounded-[8px] border-0 px-2 py-1 text-left text-xs font-semibold text-white",
  addRecordBg,
  addNeuShadow,
  "transition-all hover:bg-[#8DC9CE]/90"
);

/** Left sidebar concertina list rows */
export const intakeReportIssueListRowClassName = cn(
  "w-full flex items-center gap-2 rounded-md border-0 px-2.5 py-2 text-left text-sm font-semibold text-white",
  reportBg,
  reportNeuShadowSoft,
  "transition-all hover:bg-[#ff6b6b]/90"
);

export const intakeAddRecordListRowClassName = cn(
  "w-full flex items-center gap-2 rounded-md border-0 px-2.5 py-2 text-left text-sm font-semibold text-white",
  addRecordBg,
  addNeuShadow,
  "transition-all hover:bg-[#8DC9CE]/90"
);

export const intakeListRowReportIconClassName = "h-4 w-4 shrink-0 text-white";
export const intakeListRowAddIconClassName = "h-4 w-4 shrink-0 text-white";

/** Mobile create drawer — large tap targets */
export const intakeReportIssueDrawerCardClassName = cn(
  "w-full rounded-lg border-0 p-4 text-left transition-all text-white",
  reportBg,
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.12),inset_1px_1px_2px_0px_rgba(255,255,255,0.35)] hover:bg-[#ff6b6b]/90"
);

export const intakeAddRecordDrawerCardClassName = cn(
  "w-full rounded-lg border-0 p-4 text-left transition-all text-white",
  addRecordBg,
  addNeuShadow,
  "hover:bg-[#8DC9CE]/90"
);

export const intakeDrawerIconWrapReportClassName = "p-2 rounded-lg bg-white/20";
export const intakeDrawerIconWrapAddClassName = "p-2 rounded-lg bg-white/20";

/** Expanded mobile FAB satellites */
export const intakeFabSatelliteReportClassName = cn(
  "w-12 h-12 rounded-full border-0 flex items-center justify-center transition-transform active:scale-95 text-white",
  reportBg,
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,0.35)] hover:translate-y-[-2px]"
);

export const intakeFabSatelliteAddClassName = cn(
  "w-12 h-12 rounded-full border-0 flex items-center justify-center transition-transform active:scale-95 text-white",
  addRecordBg,
  "shadow-[1px_3px_4px_0px_rgba(0,0,0,0.1),inset_1px_1px_1px_rgba(255,255,255,0.4)] hover:translate-y-[-2px]"
);

/** Inline / compliance card footers */
export const intakeReportIssueMicroClassName = cn(
  "inline-flex items-center justify-center gap-1 rounded-[8px] border-0 px-2 py-1 text-[11px] font-semibold text-white",
  reportBg,
  "shadow-e1 transition-all hover:shadow-md hover:bg-[#ff6b6b]/90"
);

export const intakeAddRecordMicroClassName = cn(
  "inline-flex items-center justify-center gap-1 rounded-[8px] border-0 px-2 py-1 text-[11px] font-semibold text-white",
  addRecordBg,
  "shadow-e1 transition-all hover:shadow-md hover:bg-[#8DC9CE]/90"
);

/** Intake modal/column footer primary — matches active tab pill (Report Issue = coral). */
export const intakeFooterSubmitReportIssueClassName = cn(
  reportBg,
  onCta,
  reportNeuShadow,
  "hover:bg-[#ff6b6b]/90 hover:text-white"
);

/** Intake modal/column footer primary when saving compliance / Add Record path — matches Add Record tab. */
export const intakeFooterSubmitAddRecordClassName = cn(
  addRecordBg,
  onCta,
  addNeuShadow,
  "hover:bg-[#8DC9CE]/90 hover:text-white"
);
