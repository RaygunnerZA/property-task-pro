import { FileDown, FileSpreadsheet, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceSurfaceCard } from "@/components/property-workspace";
import {
  downloadReportAs,
  type ReportExportFormat,
} from "@/lib/reports/exportFiles";
import type { ReportInstance } from "@/lib/reports/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const EXPORT_OPTIONS: {
  format: ReportExportFormat;
  label: string;
  description: string;
  icon: typeof FileType;
}[] = [
  {
    format: "csv",
    label: "CSV",
    description: "Spreadsheet-ready rows",
    icon: FileType,
  },
  {
    format: "excel",
    label: "Excel",
    description: "Opens in Excel / Sheets",
    icon: FileSpreadsheet,
  },
  {
    format: "pdf",
    label: "PDF",
    description: "Download a .pdf file",
    icon: FileDown,
  },
];

type ReportExportActionsProps = {
  instance: ReportInstance;
  /** Ensure snapshot is attached before export when still a draft. */
  prepareInstance?: () => ReportInstance;
  /** Optional host handler (keeps page-level export wired for HMR / callers). */
  onExport?: (format: ReportExportFormat) => void;
  className?: string;
  title?: string;
  description?: string;
};

export function ReportExportActions({
  instance,
  prepareInstance,
  onExport,
  className,
  title = "Download",
  description = "Export this report as a file",
}: ReportExportActionsProps) {
  const runExport = (format: ReportExportFormat) => {
    if (onExport) {
      onExport(format);
      return;
    }
    const toExport = prepareInstance ? prepareInstance() : instance;
    downloadReportAs(toExport, format);
    toast.success(
      format === "csv"
        ? "CSV downloaded"
        : format === "excel"
          ? "Excel file downloaded"
          : "PDF downloaded"
    );
  };

  return (
    <WorkspaceSurfaceCard
      title={title}
      description={description}
      className={cn(className)}
    >
      <div className="flex flex-col gap-2">
        {EXPORT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <Button
              key={opt.format}
              type="button"
              variant="outline"
              className="btn-neomorphic h-auto w-full justify-start gap-2.5 px-3 py-2.5"
              onClick={() => runExport(opt.format)}
            >
              <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-medium text-foreground">
                  {opt.label}
                </span>
                <span className="block text-2xs text-muted-foreground">
                  {opt.description}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </WorkspaceSurfaceCard>
  );
}
