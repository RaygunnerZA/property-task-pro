import type { ReportTemplateId } from "@/lib/reports/types";

/** Paper-craft PNGs in `public/reports/` — white plate removed; grain applied in UI. */
export const REPORT_TEMPLATE_ILLUSTRATION: Record<ReportTemplateId, string> = {
  executive: "/reports/report-executive.png?v=2",
  maintenance: "/reports/report-maintenance.png?v=2",
  compliance: "/reports/report-compliance.png?v=2",
  insurance: "/reports/report-insurance.png?v=2",
  board: "/reports/report-board.png?v=2",
};

/** Soft washes behind cut-out illustrations (Filla teal / coral family). */
export const REPORT_TEMPLATE_WASH: Record<ReportTemplateId, string> = {
  executive: "bg-[hsl(185_42%_86%)]",
  maintenance: "bg-[hsl(16_72%_88%)]",
  compliance: "bg-[hsl(198_38%_86%)]",
  insurance: "bg-[hsl(36_58%_88%)]",
  board: "bg-[hsl(210_22%_88%)]",
};

export const REPORT_TEMPLATE_CARD_TINT: Record<ReportTemplateId, string> = {
  executive: "bg-[hsl(185_35%_94%)] hover:bg-[hsl(185_38%_92%)]",
  maintenance: "bg-[hsl(16_55%_95%)] hover:bg-[hsl(16_58%_93%)]",
  compliance: "bg-[hsl(198_30%_94%)] hover:bg-[hsl(198_34%_92%)]",
  insurance: "bg-[hsl(36_45%_95%)] hover:bg-[hsl(36_48%_93%)]",
  board: "bg-[hsl(210_18%_94%)] hover:bg-[hsl(210_20%_92%)]",
};

/** “No saved workspaces yet” state. */
export const REPORT_EMPTY_ILLUSTRATION = "/reports/report-empty.png?v=2";
export const REPORT_EMPTY_WASH = "bg-[hsl(185_30%_90%)]";
