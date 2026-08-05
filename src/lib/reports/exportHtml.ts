import type { ReportInstance } from "./types";
import { DATE_RANGE_OPTIONS } from "./dateRange";
import { getReportTemplate } from "./templates";

/** Print-friendly HTML for browser print / Save as PDF. */
export function buildReportExportHtml(instance: ReportInstance): string {
  const template = getReportTemplate(instance.templateId);
  const period =
    DATE_RANGE_OPTIONS.find((o) => o.value === instance.dateRangePreset)
      ?.label ?? instance.dateRangePreset;
  const snap = instance.snapshot;
  const kpis = snap?.kpis;
  const attention = snap?.attention ?? [];
  const tasks = snap?.taskRows ?? [];
  const compliance = snap?.complianceRows ?? [];
  const annotations = instance.annotations ?? [];

  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(instance.title)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; color: #1c1917; margin: 40px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #78716c; font-size: 13px; margin-bottom: 24px; }
  .brief { font-size: 15px; margin-bottom: 28px; max-width: 62ch; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { border: 1px solid #e7e5e4; border-radius: 12px; padding: 14px; }
  .kpi .n { font-size: 28px; font-weight: 600; }
  .kpi .l { font-size: 12px; color: #78716c; text-transform: uppercase; letter-spacing: 0.04em; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #78716c; margin: 28px 0 10px; }
  li { margin: 4px 0; }
  .notes { white-space: pre-wrap; border-top: 1px solid #e7e5e4; padding-top: 16px; margin-top: 24px; }
  @media print { body { margin: 16px; } }
</style>
</head>
<body>
  <h1>${esc(instance.title)}</h1>
  <div class="meta">${esc(template.title)} · ${esc(period)} · ${
    instance.status === "finalized" ? "Finalized" : "Draft"
  } · Exported ${esc(new Date().toLocaleString())}</div>
  <p class="brief">${esc(instance.aiSummary || snap?.briefParagraph || "")}</p>
  ${
    kpis
      ? `<div class="kpis">
    <div class="kpi"><div class="n">${kpis.needsAttention}</div><div class="l">Needs attention</div></div>
    <div class="kpi"><div class="n">${kpis.completed}</div><div class="l">Completed</div></div>
    <div class="kpi"><div class="n">${kpis.overdue}</div><div class="l">Overdue</div></div>
    <div class="kpi"><div class="n">${kpis.upcoming}</div><div class="l">Upcoming</div></div>
  </div>`
      : ""
  }
  ${
    attention.length
      ? `<h2>Attention</h2><ul>${attention
          .map(
            (a) =>
              `<li><strong>${esc(a.title)}</strong> — ${esc(a.detail)}</li>`
          )
          .join("")}</ul>`
      : ""
  }
  ${
    tasks.length
      ? `<h2>Work</h2><ul>${tasks
          .map(
            (t) =>
              `<li>${esc(t.title)}${t.urgency === "overdue" ? " (overdue)" : ""}${
                t.propertyName ? ` · ${esc(t.propertyName)}` : ""
              }</li>`
          )
          .join("")}</ul>`
      : ""
  }
  ${
    compliance.length
      ? `<h2>Compliance</h2><ul>${compliance
          .map(
            (c) =>
              `<li>${esc(c.title)}${
                c.expiryDate ? ` · ${esc(c.expiryDate)}` : ""
              }</li>`
          )
          .join("")}</ul>`
      : ""
  }
  ${
    annotations.length
      ? `<h2>Chart notes</h2><ul>${annotations
          .map((a) => `<li><strong>${esc(a.periodKey)}</strong> — ${esc(a.note)}</li>`)
          .join("")}</ul>`
      : ""
  }
  ${
    instance.notes.trim()
      ? `<div class="notes"><h2>Notes</h2><p>${esc(instance.notes)}</p></div>`
      : ""
  }
</body>
</html>`;
}

export function openReportPrintWindow(instance: ReportInstance): void {
  const html = buildReportExportHtml(instance);
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
