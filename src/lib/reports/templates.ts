import type { ReportSectionId, ReportTemplateId } from "./types";
import {
  ClipboardList,
  FileText,
  Shield,
  Briefcase,
  Landmark,
  type LucideIcon,
} from "lucide-react";

export type ReportTemplateDef = {
  id: ReportTemplateId;
  title: string;
  /** One question this report answers. */
  question: string;
  description: string;
  icon: LucideIcon;
  /** Default section recipe. */
  sections: ReportSectionId[];
  /** Spaces section only meaningful when a single property is scoped. */
  propertyScopedExtras: ReportSectionId[];
  defaultTitle: (scopeLabel: string, periodLabel: string) => string;
};

export const REPORT_TEMPLATES: ReportTemplateDef[] = [
  {
    id: "executive",
    title: "Executive Summary",
    question: "Are we okay this period?",
    description: "AI brief, pulse KPIs, top risks, and completed work.",
    icon: FileText,
    sections: ["ai_summary", "trend", "attention", "tasks", "notes"],
    propertyScopedExtras: [],
    defaultTitle: (scope, period) => `Executive Summary — ${scope} (${period})`,
  },
  {
    id: "maintenance",
    title: "Maintenance Review",
    question: "What’s the work story?",
    description: "Demand trend, overdue work, and where activity concentrates.",
    icon: ClipboardList,
    sections: ["ai_summary", "trend", "attention", "tasks", "notes"],
    propertyScopedExtras: ["spaces"],
    defaultTitle: (scope, period) => `Maintenance Review — ${scope} (${period})`,
  },
  {
    id: "compliance",
    title: "Compliance Review",
    question: "What’s expiring, missing, or overdue?",
    description: "Certificates, expiry risk, and compliance attention items.",
    icon: Shield,
    sections: ["ai_summary", "attention", "compliance", "notes"],
    propertyScopedExtras: [],
    defaultTitle: (scope, period) => `Compliance Review — ${scope} (${period})`,
  },
  {
    id: "insurance",
    title: "Insurance Pack",
    question: "What evidence and risk should an insurer see?",
    description: "Risk items, compliance status, and supporting task evidence.",
    icon: Briefcase,
    sections: ["ai_summary", "attention", "compliance", "tasks", "evidence", "notes"],
    propertyScopedExtras: [],
    defaultTitle: (scope, period) => `Insurance Pack — ${scope} (${period})`,
  },
  {
    id: "board",
    title: "Board Pack",
    question: "What changed, and what are the top risks?",
    description: "Period narrative, trends, risks, and notes for leadership.",
    icon: Landmark,
    sections: ["ai_summary", "trend", "attention", "tasks", "compliance", "notes"],
    propertyScopedExtras: [],
    defaultTitle: (scope, period) => `Board Pack — ${scope} (${period})`,
  },
];

export function getReportTemplate(id: ReportTemplateId): ReportTemplateDef {
  const found = REPORT_TEMPLATES.find((t) => t.id === id);
  if (!found) return REPORT_TEMPLATES[0];
  return found;
}

export function resolveReportSections(
  templateId: ReportTemplateId,
  isSingleProperty: boolean
): ReportSectionId[] {
  const template = getReportTemplate(templateId);
  const extras = isSingleProperty ? template.propertyScopedExtras : [];
  const set = new Set<ReportSectionId>([...template.sections, ...extras]);
  const order: ReportSectionId[] = [
    "ai_summary",
    "trend",
    "attention",
    "tasks",
    "compliance",
    "spaces",
    "evidence",
    "notes",
  ];
  return order.filter((s) => set.has(s));
}
