import { jsPDF } from "jspdf";
import type { ReportInstance } from "./types";
import { DATE_RANGE_OPTIONS } from "./dateRange";
import { getReportTemplate } from "./templates";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function slugifyFilename(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base || "report";
}

/**
 * Build a real PDF blob in the browser (no print dialog / popup).
 * Text-first layout matching the CSV/Excel export content.
 */
export function buildReportPdfBlob(instance: ReportInstance): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const template = getReportTemplate(instance.templateId);
  const period =
    DATE_RANGE_OPTIONS.find((o) => o.value === instance.dateRangePreset)?.label ??
    instance.dateRangePreset;
  const snap = instance.snapshot;

  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed <= PAGE_HEIGHT - MARGIN) return;
    doc.addPage();
    y = MARGIN;
  };

  const writeWrapped = (
    text: string,
    opts: { size?: number; style?: "normal" | "bold"; color?: [number, number, number]; gap?: number } = {}
  ) => {
    const size = opts.size ?? 10;
    const style = opts.style ?? "normal";
    const color = opts.color ?? ([28, 25, 23] as [number, number, number]);
    const gap = opts.gap ?? 6;
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text || "—", CONTENT_WIDTH) as string[];
    const lineHeight = size * 1.35;
    ensureSpace(lines.length * lineHeight + gap);
    for (const line of lines) {
      doc.text(line, MARGIN, y);
      y += lineHeight;
    }
    y += gap;
  };

  const writeHeading = (label: string) => {
    y += 4;
    writeWrapped(label.toUpperCase(), {
      size: 9,
      style: "bold",
      color: [120, 113, 108],
      gap: 8,
    });
  };

  writeWrapped(instance.title, { size: 18, style: "bold", gap: 4 });
  writeWrapped(
    `${template.title} · ${period} · ${
      instance.status === "finalized" ? "Finalized" : "Draft"
    } · Exported ${new Date().toLocaleString()}`,
    { size: 9, color: [120, 113, 108], gap: 14 }
  );

  const brief = instance.aiSummary || snap?.briefParagraph || "";
  if (brief.trim()) {
    writeHeading("Summary");
    writeWrapped(brief.trim(), { size: 11, gap: 12 });
  }

  if (snap?.kpis) {
    writeHeading("Key metrics");
    writeWrapped(
      [
        `Needs attention: ${snap.kpis.needsAttention}`,
        `Completed: ${snap.kpis.completed}`,
        `Overdue: ${snap.kpis.overdue}`,
        `Upcoming: ${snap.kpis.upcoming}`,
      ].join("    "),
      { size: 11, gap: 12 }
    );
  }

  if (snap?.attention?.length) {
    writeHeading("Attention");
    for (const item of snap.attention) {
      writeWrapped(`${item.title} — ${item.detail}`, { size: 10, gap: 4 });
    }
    y += 6;
  }

  if (snap?.taskRows?.length) {
    writeHeading("Work");
    for (const task of snap.taskRows) {
      const bits = [
        task.title,
        task.urgency === "overdue" ? "(overdue)" : "",
        task.propertyName ? `· ${task.propertyName}` : "",
        task.dueDate ? `· due ${task.dueDate}` : "",
      ].filter(Boolean);
      writeWrapped(bits.join(" "), { size: 10, gap: 4 });
    }
    y += 6;
  }

  if (snap?.complianceRows?.length) {
    writeHeading("Compliance");
    for (const row of snap.complianceRows) {
      const bits = [
        row.title,
        row.propertyName ? `· ${row.propertyName}` : "",
        row.expiryDate ? `· ${row.expiryDate}` : "",
        row.expiryState ? `· ${row.expiryState}` : "",
      ].filter(Boolean);
      writeWrapped(bits.join(" "), { size: 10, gap: 4 });
    }
    y += 6;
  }

  if (snap?.spaceRows?.length) {
    writeHeading("Spaces");
    for (const space of snap.spaceRows) {
      writeWrapped(
        `${space.name} — ${space.taskCount} task${space.taskCount === 1 ? "" : "s"}`,
        { size: 10, gap: 4 }
      );
    }
    y += 6;
  }

  if (snap?.trend?.length) {
    writeHeading("Trend");
    for (const point of snap.trend) {
      writeWrapped(
        `${point.label}: created ${point.created}, completed ${point.completed}`,
        { size: 10, gap: 4 }
      );
    }
    y += 6;
  }

  if (instance.annotations?.length) {
    writeHeading("Chart notes");
    for (const note of instance.annotations) {
      writeWrapped(`${note.periodKey} — ${note.note}`, { size: 10, gap: 4 });
    }
    y += 6;
  }

  if (instance.notes.trim()) {
    writeHeading("Notes");
    writeWrapped(instance.notes.trim(), { size: 10, gap: 8 });
  }

  return doc.output("blob");
}

export function downloadReportPdfFile(instance: ReportInstance): void {
  const blob = buildReportPdfBlob(instance);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugifyFilename(instance.title)}.pdf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
