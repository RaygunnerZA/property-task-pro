import { format, startOfDay } from "date-fns";

export type ComplianceStatus = "healthy" | "expiring" | "overdue" | "missing";

export interface ComplianceRecord {
  id: string;
  title: string;
  propertyName: string;
  propertyId?: string | null;
  complianceType: string;
  expiryDate?: string | null;
  nextDueDate?: string | null;
  status: ComplianceStatus;
  linkedDocument: string;
  inspectionHistory: string[];
  linkedTasks: string[];
  notes: string;
}

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  healthy: "Healthy",
  expiring: "Expiring",
  overdue: "Overdue",
  missing: "Missing",
};

export function normalizeComplianceStatus(rawState?: string | null): ComplianceStatus {
  const state = String(rawState || "").toLowerCase();
  if (state.includes("overdue") || state.includes("expired")) return "overdue";
  if (state.includes("missing") || state.includes("none")) return "missing";
  if (state.includes("expiring") || state.includes("due_soon")) return "expiring";
  if (state.includes("valid") || state.includes("healthy")) return "healthy";
  return "healthy";
}

export function daysUntil(dateString?: string | null): number | null {
  if (!dateString) return null;
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = startOfDay(new Date());
  const due = startOfDay(parsed);
  const diff = due.getTime() - now.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function formatDueText(dateString?: string | null): string {
  if (!dateString) return "No expiry date";
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "No expiry date";
  return format(parsed, "dd MMM yyyy");
}

export function buildComplianceRecordsFromPortfolio(
  compliancePortfolio: unknown[],
  extra: ComplianceRecord[] = []
): ComplianceRecord[] {
  const recordsFromView = (compliancePortfolio as Record<string, unknown>[]).map((row) => {
    const title = (row.title as string) || (row.document_type as string) || "Compliance Record";
    const propertyName = (row.property_name as string) || "Unassigned property";
    const dueOrExpiry = (row.next_due_date as string) || (row.expiry_date as string);
    const computedStatus = normalizeComplianceStatus(
      (row.expiry_state as string) || (row.status as string)
    );
    const dayDelta = daysUntil(dueOrExpiry);

    let status = computedStatus;
    if (status === "healthy" && dayDelta !== null && dayDelta <= 30 && dayDelta >= 0) {
      status = "expiring";
    }
    if (status === "healthy" && dayDelta !== null && dayDelta < 0) {
      status = "overdue";
    }

    return {
      id: String(row.id || `compliance-${Math.random().toString(36).slice(2, 10)}`),
      title,
      propertyName,
      propertyId: row.property_id as string | null | undefined,
      complianceType: (row.document_type as string) || "General",
      expiryDate: row.expiry_date as string | null | undefined,
      nextDueDate: row.next_due_date as string | null | undefined,
      status,
      linkedDocument: (row.title as string) || (row.document_type as string) || "Document",
      inspectionHistory: row.next_due_date
        ? [`Next due ${formatDueText(row.next_due_date as string)}`]
        : ["No inspection history yet"],
      linkedTasks: [] as string[],
      notes:
        Array.isArray(row.hazards) && (row.hazards as unknown[]).length > 0
          ? `Potential hazards: ${(row.hazards as string[]).join(", ")}`
          : "No hazards flagged.",
    } satisfies ComplianceRecord;
  });

  const merged = [...extra, ...recordsFromView];
  const byId = new Map<string, ComplianceRecord>();
  merged.forEach((record) => {
    if (!byId.has(record.id)) byId.set(record.id, record);
  });
  return Array.from(byId.values());
}

export function getComplianceStatusText(record: ComplianceRecord): string {
  const due = record.nextDueDate || record.expiryDate;
  const dayDelta = daysUntil(due);
  if (record.status === "missing") return "Status: Missing record";
  if (dayDelta === null) return `Status: ${STATUS_LABEL[record.status]}`;
  if (dayDelta < 0) return `Status: Overdue by ${Math.abs(dayDelta)} day${Math.abs(dayDelta) === 1 ? "" : "s"}`;
  if (dayDelta <= 30) return `Status: Expiring in ${dayDelta} day${dayDelta === 1 ? "" : "s"}`;
  return `Status: ${STATUS_LABEL[record.status]}`;
}
