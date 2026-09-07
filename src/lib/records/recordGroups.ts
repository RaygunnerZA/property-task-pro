import {
  ClipboardCheck,
  FileText,
  FolderOpen,
  Shield,
  Waves,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/hooks/property/usePropertyDocuments";

export type RecordGroupId = DocumentCategory | "compliance" | "uncategorised";

export type RecordGroupDef = {
  id: RecordGroupId;
  label: string;
  description: string;
  color: string;
  icon: LucideIcon;
};

const CATEGORY_META: Record<
  DocumentCategory,
  { color: string; icon: LucideIcon; description: string }
> = {
  Plans: {
    color: "#6C757D",
    icon: FolderOpen,
    description: "Floor plans, elevations, and building drawings.",
  },
  Legal: {
    color: "#495057",
    icon: FileText,
    description: "Leases, licences, and legal correspondence.",
  },
  "Fire Safety": {
    color: "#EB6834",
    icon: Shield,
    description: "Fire certificates, risk assessments, and drills.",
  },
  Electrical: {
    color: "#F4A261",
    icon: ClipboardCheck,
    description: "EICR, fixed wire tests, and electrical certificates.",
  },
  Mechanical: {
    color: "#E9C46A",
    icon: Wrench,
    description: "Plant certificates and mechanical inspections.",
  },
  Water: {
    color: "#2A9D8F",
    icon: Waves,
    description: "Legionella, water hygiene, and plumbing records.",
  },
  Insurance: {
    color: "#457B9D",
    icon: FileText,
    description: "Policies, schedules, and claims evidence.",
  },
  Contractors: {
    color: "#A8DADC",
    icon: ClipboardCheck,
    description: "Contractor packs, RAMS, and method statements.",
  },
  Warranties: {
    color: "#E76F51",
    icon: FileText,
    description: "Manufacturer warranties and guarantees.",
  },
  "O&M Manuals": {
    color: "#264653",
    icon: FolderOpen,
    description: "Operation and maintenance manuals.",
  },
  Misc: {
    color: "#ADB5BD",
    icon: FileText,
    description: "Other stored evidence and attachments.",
  },
};

/** Spaces-style group axes for Records — document categories + compliance obligations. */
export const RECORD_GROUPS: RecordGroupDef[] = [
  {
    id: "compliance",
    label: "Compliance",
    description: "Certificates, inspections, and portfolio obligations.",
    color: "#8EC9CE",
    icon: Shield,
  },
  ...DOCUMENT_CATEGORIES.map((category): RecordGroupDef => {
    const meta = CATEGORY_META[category];
    return {
      id: category,
      label: category,
      description: meta.description,
      color: meta.color,
      icon: meta.icon,
    };
  }),
  {
    id: "uncategorised",
    label: "Uncategorised",
    description: "Stored files without a document category yet.",
    color: "#CED4DA",
    icon: FileText,
  },
];

export function getRecordGroup(id: RecordGroupId): RecordGroupDef | undefined {
  return RECORD_GROUPS.find((g) => g.id === id);
}
