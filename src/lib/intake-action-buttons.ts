import { cn } from "@/lib/utils";

/**
 * Canonical FILLA intake CTA styling:
 * Report issue = Filla orange (accent / coral), Add record = light teal surface + deep teal text.
 */
const reportNeuShadow =
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,0.4)]";
const reportNeuShadowSoft =
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.1),inset_1px_1px_2px_0px_rgba(255,255,255,0.35)]";

export const intakeReportIssueButtonClassName = cn(
  "flex min-h-[40px] min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border-0 px-3 py-2 text-sm font-semibold text-accent-foreground",
  "bg-accent",
  reportNeuShadow,
  "transition-all hover:bg-accent/90",
  "lg:justify-start lg:px-2.5"
);

export const intakeAddRecordButtonClassName = cn(
  "flex min-h-[40px] min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border-0 px-3 py-2 text-sm font-semibold leading-none",
  "bg-primary/25 text-primary-deep shadow-e1 transition-all hover:shadow-md",
  "lg:justify-start lg:px-2.5"
);

export const intakeReportIssueIconClassName = "h-3.5 w-3.5 shrink-0 text-accent-foreground";
export const intakeAddRecordIconClassName = "h-3.5 w-3.5 shrink-0 text-primary-deep";

/** Narrow sidebar quick actions (Attention column) */
export const intakeReportIssueCompactClassName = cn(
  "flex h-auto w-[85px] items-center justify-center rounded-[8px] border-0 px-2 py-1 text-xs font-semibold text-accent-foreground",
  "bg-accent",
  reportNeuShadow,
  "transition-all hover:bg-accent/90"
);

export const intakeAddRecordCompactClassName = cn(
  "flex h-auto w-[85px] items-center justify-center rounded-[8px] border-0 px-2 py-1 text-xs font-semibold",
  "bg-primary/25 text-primary-deep shadow-e1 transition-all hover:shadow-md"
);

/** Left sidebar concertina list rows */
export const intakeReportIssueListRowClassName = cn(
  "w-full flex items-center gap-2 rounded-md border-0 px-2.5 py-2 text-left text-sm font-semibold text-accent-foreground",
  "bg-accent",
  reportNeuShadowSoft,
  "transition-all hover:bg-accent/90"
);

export const intakeAddRecordListRowClassName = cn(
  "w-full flex items-center gap-2 rounded-md border-0 px-2.5 py-2 text-left text-sm font-semibold",
  "bg-primary/25 text-primary-deep shadow-e1 transition-all hover:shadow-md"
);

export const intakeListRowReportIconClassName = "h-4 w-4 shrink-0 text-accent-foreground";
export const intakeListRowAddIconClassName = "h-4 w-4 shrink-0 text-primary-deep";

/** Mobile create drawer — large tap targets */
export const intakeReportIssueDrawerCardClassName = cn(
  "w-full rounded-lg border-0 p-4 text-left transition-all",
  "bg-accent text-accent-foreground",
  "shadow-[2px_4px_6px_0px_rgba(0,0,0,0.12),inset_1px_1px_2px_0px_rgba(255,255,255,0.35)] hover:bg-accent/90"
);

export const intakeAddRecordDrawerCardClassName = cn(
  "w-full rounded-lg border-0 p-4 text-left transition-all",
  "bg-primary/25 text-primary-deep shadow-e1 hover:shadow-md"
);

export const intakeDrawerIconWrapReportClassName = "p-2 rounded-lg bg-white/20";
export const intakeDrawerIconWrapAddClassName = "p-2 rounded-lg bg-primary/35";

/** Expanded mobile FAB satellites */
export const intakeFabSatelliteReportClassName = cn(
  "w-12 h-12 rounded-full border-0 flex items-center justify-center transition-transform active:scale-95",
  "bg-accent text-accent-foreground shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,0.35)] hover:translate-y-[-2px]"
);

export const intakeFabSatelliteAddClassName = cn(
  "w-12 h-12 rounded-full border-0 flex items-center justify-center transition-transform active:scale-95",
  "bg-primary/25 text-primary-deep shadow-[1px_3px_4px_0px_rgba(0,0,0,0.1),inset_1px_1px_1px_rgba(255,255,255,0.4)] hover:translate-y-[-2px]"
);

/** Inline / compliance card footers */
export const intakeReportIssueMicroClassName = cn(
  "inline-flex items-center justify-center rounded-[8px] border-0 px-2 py-1 text-[11px] font-semibold text-accent-foreground",
  "bg-accent shadow-e1 transition-all hover:shadow-md hover:bg-accent/90"
);

export const intakeAddRecordMicroClassName = cn(
  "inline-flex items-center justify-center rounded-[8px] border-0 px-2 py-1 text-[11px] font-semibold",
  "bg-primary/25 text-primary-deep shadow-e1 transition-all hover:shadow-md"
);
