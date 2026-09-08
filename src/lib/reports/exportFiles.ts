import type { ReportInstance } from "./types";
import { DATE_RANGE_OPTIONS } from "./dateRange";
import { getReportTemplate } from "./templates";
import { buildReportExportHtml } from "./exportHtml";
import { downloadReportPdfFile } from "./exportPdf";

export type ReportExportFormat = "csv" | "excel" | "pdf";

function slugifyFilename(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base || "report";
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type FlatRow = { section: string; field: string; value: string };

/** Flatten a report instance into tabular rows for CSV / Excel. */
export function buildReportFlatRows(instance: ReportInstance): FlatRow[] {
  const template = getReportTemplate(instance.templateId);
  const period =
    DATE_RANGE_OPTIONS.find((o) => o.value === instance.dateRangePreset)?.label ??
    instance.dateRangePreset;
  const snap = instance.snapshot;
  const rows: FlatRow[] = [
    { section: "Meta", field: "Title", value: instance.title },
    { section: "Meta", field: "Template", value: template.title },
    { section: "Meta", field: "Period", value: period },
    { section: "Meta", field: "Status", value: instance.status },
    {
      section: "Meta",
      field: "Exported at",
      value: new Date().toISOString(),
    },
    {
      section: "Summary",
      field: "Brief",
      value: instance.aiSummary || snap?.briefParagraph || "",
    },
  ];

  if (snap?.kpis) {
    rows.push(
      { section: "KPI", field: "Needs attention", value: String(snap.kpis.needsAttention) },
      { section: "KPI", field: "Completed", value: String(snap.kpis.completed) },
      { section: "KPI", field: "Overdue", value: String(snap.kpis.overdue) },
      { section: "KPI", field: "Upcoming", value: String(snap.kpis.upcoming) }
    );
  }

  for (const item of snap?.attention ?? []) {
    rows.push({
      section: "Attention",
      field: item.title,
      value: `${item.severity} · ${item.detail}`,
    });
  }

  for (const task of snap?.taskRows ?? []) {
    rows.push({
      section: "Tasks",
      field: task.title,
      value: [
        task.status,
        task.urgency ?? "",
        task.propertyName ?? "",
        task.dueDate ?? "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  for (const row of snap?.complianceRows ?? []) {
    rows.push({
      section: "Compliance",
      field: row.title,
      value: [
        row.propertyName ?? "",
        row.expiryDate ?? "",
        row.expiryState ?? "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  for (const space of snap?.spaceRows ?? []) {
    rows.push({
      section: "Spaces",
      field: space.name,
      value: `${space.taskCount} task${space.taskCount === 1 ? "" : "s"}`,
    });
  }

  for (const point of snap?.trend ?? []) {
    rows.push({
      section: "Trend",
      field: point.label,
      value: `created ${point.created}, completed ${point.completed}`,
    });
  }

  for (const note of instance.annotations ?? []) {
    rows.push({
      section: "Chart notes",
      field: note.periodKey,
      value: note.note,
    });
  }

  if (instance.notes.trim()) {
    rows.push({ section: "Notes", field: "Body", value: instance.notes.trim() });
  }

  return rows;
}

export function buildReportCsv(instance: ReportInstance): string {
  const rows = buildReportFlatRows(instance);
  const lines = ["Section,Field,Value"];
  for (const row of rows) {
    lines.push(
      [row.section, row.field, row.value].map(csvEscape).join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Excel-compatible SpreadsheetML (.xls). Opens in Excel / Numbers / Sheets
 * without adding a binary spreadsheet dependency.
 */
export function buildReportExcelXml(instance: ReportInstance): string {
  const rows = buildReportFlatRows(instance);
  const cells = (values: string[]) =>
    values
      .map((v) => `<Cell><Data ss:Type="String">${xmlEscape(v)}</Data></Cell>`)
      .join("");

  const tableRows = [
    `<Row>${cells(["Section", "Field", "Value"])}</Row>`,
    ...rows.map(
      (row) => `<Row>${cells([row.section, row.field, row.value])}</Row>`
    ),
  ].join("\n");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Report">
  <Table>
${tableRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function downloadReportCsv(instance: ReportInstance): void {
  const csv = buildReportCsv(instance);
  triggerDownload(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
    `${slugifyFilename(instance.title)}.csv`
  );
}

export function downloadReportExcel(instance: ReportInstance): void {
  const xml = buildReportExcelXml(instance);
  triggerDownload(
    new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" }),
    `${slugifyFilename(instance.title)}.xls`
  );
}

/** Generate and download a real PDF file (client-side via jsPDF). */
export function downloadReportPdf(instance: ReportInstance): void {
  downloadReportPdfFile(instance);
}

export function downloadReportAs(
  instance: ReportInstance,
  format: ReportExportFormat
): void {
  if (format === "csv") {
    downloadReportCsv(instance);
    return;
  }
  if (format === "excel") {
    downloadReportExcel(instance);
    return;
  }
  downloadReportPdf(instance);
}

/** Optional: save the print HTML as a .html file for archival. */
export function downloadReportHtml(instance: ReportInstance): void {
  const html = buildReportExportHtml(instance);
  triggerDownload(
    new Blob([html], { type: "text/html;charset=utf-8" }),
    `${slugifyFilename(instance.title)}.html`
  );
}
