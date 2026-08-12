import type { ReportTemplateId } from "@/lib/reports/types";

/** Paper-craft PNGs in `public/reports/` — same visual language as the workbench section art. */
export const REPORT_TEMPLATE_ILLUSTRATION: Record<ReportTemplateId, string> = {
  executive: "/reports/report-executive.png",
  maintenance: "/reports/report-maintenance.png",
  compliance: "/reports/report-compliance.png",
  insurance: "/reports/report-insurance.png",
  board: "/reports/report-board.png",
};

/** “No saved workspaces yet” state. */
export const REPORT_EMPTY_ILLUSTRATION = "/reports/report-empty.png";
