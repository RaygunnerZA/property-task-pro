import type {
  ReportComplianceRow,
  ReportSpaceRow,
  ReportTaskRow,
} from "@/lib/reports/types";
import { cn } from "@/lib/utils";

export function ReportTasksSection({ rows }: { rows: ReportTaskRow[] }) {
  return (
    <section className="rounded-xl bg-card/70 p-5 shadow-e1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Work
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No open work in scope.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex min-w-0 flex-col gap-1 rounded-[10px] bg-background/80 p-3 shadow-e1"
            >
              <div className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                {row.title}
              </div>
              <div className="line-clamp-1 text-xs text-muted-foreground">
                {[row.propertyName, row.status].filter(Boolean).join(" · ")}
              </div>
              {row.urgency ? (
                <span
                  className={cn(
                    "mt-auto pt-1 text-xs font-medium",
                    row.urgency === "overdue"
                      ? "text-[#EB6834]"
                      : "text-muted-foreground"
                  )}
                >
                  {row.urgency === "overdue" ? "Overdue" : "Due soon"}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ReportComplianceSection({
  rows,
}: {
  rows: ReportComplianceRow[];
}) {
  return (
    <section className="rounded-xl bg-card/70 p-5 shadow-e1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Compliance
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No expiring or overdue compliance items in this window.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border/40">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{row.title}</div>
                <div className="text-xs text-muted-foreground">
                  {[row.propertyName, row.expiryState].filter(Boolean).join(" · ")}
                </div>
              </div>
              {row.expiryDate && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {row.expiryDate}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ReportSpacesSection({ rows }: { rows: ReportSpaceRow[] }) {
  return (
    <section className="rounded-xl bg-card/70 p-5 shadow-e1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Most active spaces
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No space-linked open work yet for this property.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li
              key={row.name}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="font-medium text-foreground">{row.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {row.taskCount} open
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ReportEvidenceSection() {
  return (
    <section className="rounded-xl bg-card/70 p-5 shadow-e1">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Evidence
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Photo and document evidence for this pack will attach from linked tasks and
        compliance records on export. Browse Records for the full archive.
      </p>
    </section>
  );
}

export function ReportNotesSection({
  notes,
  onChange,
  readOnly,
}: {
  notes: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <section className="rounded-xl bg-card/70 p-5 shadow-e1">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      {readOnly ? (
        <p className="whitespace-pre-wrap text-sm text-foreground">
          {notes.trim() || "No notes."}
        </p>
      ) : (
        <textarea
          value={notes}
          onChange={(e) => onChange?.(e.target.value)}
          rows={4}
          placeholder="Board comments, context for next month, decisions…"
          className="w-full resize-y rounded-lg border-0 bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70"
        />
      )}
    </section>
  );
}
