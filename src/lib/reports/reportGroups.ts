import {
  ClipboardList,
  Landmark,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { ReportTemplateId } from "./types";
import { REPORT_TEMPLATES } from "./templates";

export type ReportGroupId = "operations" | "risk" | "leadership";

export type ReportGroupDef = {
  id: ReportGroupId;
  label: string;
  description: string;
  color: string;
  icon: LucideIcon;
  templateIds: ReportTemplateId[];
};

/** Browse axes for the Reports foyer — mirrors Records “Your Cabinet” groups. */
export const REPORT_GROUPS: ReportGroupDef[] = [
  {
    id: "operations",
    label: "Operations",
    description: "Pulse and maintenance — are we okay, and what’s the work story?",
    color: "#8EC9CE",
    icon: ClipboardList,
    templateIds: ["executive", "maintenance"],
  },
  {
    id: "risk",
    label: "Risk & compliance",
    description: "Certificates, expiry risk, and packs for insurers.",
    color: "#EB6834",
    icon: Shield,
    templateIds: ["compliance", "insurance"],
  },
  {
    id: "leadership",
    label: "Leadership",
    description: "Board-ready narrative of change, risks, and decisions.",
    color: "#6B7C8F",
    icon: Landmark,
    templateIds: ["board"],
  },
];

export function templatesInGroup(groupId: ReportGroupId | null) {
  if (!groupId) return REPORT_TEMPLATES;
  const group = REPORT_GROUPS.find((g) => g.id === groupId);
  if (!group) return REPORT_TEMPLATES;
  const set = new Set(group.templateIds);
  return REPORT_TEMPLATES.filter((t) => set.has(t.id));
}

export function groupForTemplate(templateId: ReportTemplateId): ReportGroupDef {
  return (
    REPORT_GROUPS.find((g) => g.templateIds.includes(templateId)) ??
    REPORT_GROUPS[0]
  );
}
