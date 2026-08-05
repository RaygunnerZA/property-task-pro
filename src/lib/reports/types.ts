/** Report template products — not checkbox builders. */
export type ReportTemplateId =
  | "executive"
  | "maintenance"
  | "compliance"
  | "insurance"
  | "board";

export type ReportDateRangePreset = "7d" | "30d" | "90d" | "ytd";

export type ReportInstanceStatus = "draft" | "finalized";

/** Section keys that can appear in a live workspace. */
export type ReportSectionId =
  | "ai_summary"
  | "trend"
  | "attention"
  | "tasks"
  | "compliance"
  | "spaces"
  | "evidence"
  | "notes";

export type ChartAnnotation = {
  id: string;
  /** Bucket key, e.g. `2026-07` or ISO week label shown on the chart. */
  periodKey: string;
  note: string;
  createdAt: string;
};

/** Frozen metrics at finalize time so history does not mutate. */
export type ReportSnapshot = {
  frozenAt: string;
  kpis: ReportKpis;
  briefParagraph: string;
  trend: ReportTrendPoint[];
  attention: ReportAttentionItem[];
  taskRows: ReportTaskRow[];
  complianceRows: ReportComplianceRow[];
  spaceRows: ReportSpaceRow[];
};

export type ReportKpis = {
  needsAttention: number;
  completed: number;
  overdue: number;
  upcoming: number;
};

export type ReportTrendPoint = {
  key: string;
  label: string;
  created: number;
  completed: number;
};

export type ReportAttentionItem = {
  id: string;
  kind: "task" | "compliance" | "signal";
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
};

export type ReportTaskRow = {
  id: string;
  title: string;
  status: string;
  propertyName: string | null;
  dueDate: string | null;
  urgency: "overdue" | "due_soon" | null;
};

export type ReportComplianceRow = {
  id: string;
  title: string;
  propertyName: string | null;
  expiryDate: string | null;
  expiryState: string | null;
};

export type ReportSpaceRow = {
  name: string;
  taskCount: number;
};

export type ReportInstance = {
  id: string;
  orgId: string;
  templateId: ReportTemplateId;
  title: string;
  /** Empty / all properties in org = portfolio scope. */
  propertyIds: string[];
  dateRangePreset: ReportDateRangePreset;
  status: ReportInstanceStatus;
  /** Editable consultant-style summary; seeded from rule-based brief. */
  aiSummary: string;
  notes: string;
  annotations: ChartAnnotation[];
  snapshot: ReportSnapshot | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
};

export type ReportScope = {
  propertyIds: string[];
  dateRangePreset: ReportDateRangePreset;
  comparePrevious: boolean;
};
