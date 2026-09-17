/**
 * Pure filters for the Records document explorer.
 * Category and location are independent intersecting attributes.
 */

import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import type { RecordGroupId } from "@/lib/records/recordGroups";
import { isPropertyLevelDocument } from "@/lib/records/attachmentSpaces";

export type ExplorerCategoryId = "all" | RecordGroupId;

/** Carousel order — discovery-first, then remaining categories. */
export const EXPLORER_CATEGORY_ORDER: ExplorerCategoryId[] = [
  "all",
  "compliance",
  "Plans",
  "Warranties",
  "O&M Manuals",
  "Contractors",
  "Fire Safety",
  "Electrical",
  "Mechanical",
  "Water",
  "Insurance",
  "Legal",
  "Misc",
  "uncategorised",
];

export type ExplorerLocationFilter =
  | { kind: "all" }
  | { kind: "property-level" }
  | { kind: "area"; areaId: string; spaceIds: string[] }
  | { kind: "space"; spaceId: string };

export type ExplorerAttentionFilter =
  | "all"
  | "needs-attention"
  | "expiring"
  | "missing-info";

export const COMPLIANCE_DOC_CATEGORIES = [
  "Fire Safety",
  "Electrical",
  "Water",
  "Mechanical",
] as const;

export function documentExpiryState(
  d: PropertyDocument
): "overdue" | "expiring" | "none" {
  if (!d.expiry_date) return "none";
  const t = new Date(d.expiry_date).getTime();
  if (Number.isNaN(t)) return "none";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(d.expiry_date);
  exp.setHours(0, 0, 0, 0);
  if (exp < today) return "overdue";
  const diff = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 30) return "expiring";
  return "none";
}

export function documentHasMissingInfo(d: PropertyDocument): boolean {
  const title = d.title?.trim();
  const category = d.category?.trim();
  return !title || !category;
}

export function documentNeedsAttention(d: PropertyDocument): boolean {
  const expiry = documentExpiryState(d);
  return expiry === "overdue" || expiry === "expiring" || documentHasMissingInfo(d);
}

export function matchesExplorerCategory(
  d: PropertyDocument,
  category: ExplorerCategoryId
): boolean {
  if (category === "all") return true;
  if (category === "compliance") {
    return COMPLIANCE_DOC_CATEGORIES.some((c) => c === d.category);
  }
  if (category === "uncategorised") return !d.category;
  return d.category === category;
}

export function matchesExplorerLocation(
  d: PropertyDocument,
  location: ExplorerLocationFilter
): boolean {
  if (location.kind === "all") return true;
  if (location.kind === "property-level") return isPropertyLevelDocument(d);
  const linked = new Set((d.linked_spaces ?? []).map((s) => s.id));
  if (location.kind === "space") return linked.has(location.spaceId);
  return location.spaceIds.some((id) => linked.has(id));
}

export function matchesExplorerAttention(
  d: PropertyDocument,
  attention: ExplorerAttentionFilter
): boolean {
  if (attention === "all") return true;
  if (attention === "needs-attention") return documentNeedsAttention(d);
  if (attention === "expiring") {
    const s = documentExpiryState(d);
    return s === "expiring" || s === "overdue";
  }
  return documentHasMissingInfo(d);
}

export function matchesExplorerSearch(d: PropertyDocument, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${d.title ?? ""} ${d.file_name ?? ""} ${d.category ?? ""} ${d.document_type ?? ""}`
    .toLowerCase()
    .includes(q);
}

export function filterExplorerDocuments(
  documents: PropertyDocument[],
  opts: {
    category: ExplorerCategoryId;
    location: ExplorerLocationFilter;
    attention: ExplorerAttentionFilter;
    search: string;
  }
): PropertyDocument[] {
  return documents.filter(
    (d) =>
      matchesExplorerCategory(d, opts.category) &&
      matchesExplorerLocation(d, opts.location) &&
      matchesExplorerAttention(d, opts.attention) &&
      matchesExplorerSearch(d, opts.search)
  );
}

export function countByExplorerCategory(
  documents: PropertyDocument[],
  category: ExplorerCategoryId
): number {
  return documents.filter((d) => matchesExplorerCategory(d, category)).length;
}

export function attentionCountForCategory(
  documents: PropertyDocument[],
  category: ExplorerCategoryId
): number {
  return documents.filter(
    (d) => matchesExplorerCategory(d, category) && documentNeedsAttention(d)
  ).length;
}

export function explorerCategoryLabel(category: ExplorerCategoryId): string {
  if (category === "all") return "All records";
  if (category === "Misc") return "Miscellaneous";
  if (category === "O&M Manuals") return "O&M manuals";
  if (category === "Fire Safety") return "Fire safety";
  return category === "uncategorised" ? "Uncategorised" : category;
}

export function explorerCategoryDescription(category: ExplorerCategoryId): string {
  if (category === "all") return "Every stored document for this property.";
  if (category === "compliance") return "Certificates and inspections.";
  if (category === "uncategorised") return "Files without a category yet.";
  if (category === "Misc") return "Other stored evidence and attachments.";
  if (category === "O&M Manuals") return "Operation and maintenance manuals.";
  if (category === "Plans") return "Floor plans and building drawings.";
  if (category === "Warranties") return "Manufacturer warranties and guarantees.";
  if (category === "Contractors") return "Contractor packs and method statements.";
  if (category === "Fire Safety") return "Fire certificates and risk assessments.";
  if (category === "Electrical") return "EICR and electrical certificates.";
  if (category === "Mechanical") return "Plant certificates and inspections.";
  if (category === "Water") return "Water hygiene and plumbing records.";
  if (category === "Insurance") return "Policies, schedules, and claims.";
  if (category === "Legal") return "Leases, licences, and correspondence.";
  return "";
}

export function locationFilterLabel(
  location: ExplorerLocationFilter,
  opts?: {
    spaceNameById?: Record<string, string>;
    areaNameById?: Record<string, string>;
  }
): string | null {
  if (location.kind === "all") return null;
  if (location.kind === "property-level") return "Property level";
  if (location.kind === "space") {
    return opts?.spaceNameById?.[location.spaceId] ?? "Space";
  }
  return opts?.areaNameById?.[location.areaId] ?? "Area";
}

export function describeEmptyExplorerState(opts: {
  category: ExplorerCategoryId;
  location: ExplorerLocationFilter;
  locationLabel: string | null;
}): string {
  const cat = explorerCategoryLabel(opts.category);
  if (opts.location.kind === "all") {
    return opts.category === "all" ? "No documents yet" : `No ${cat} documents`;
  }
  if (opts.location.kind === "property-level") {
    return opts.category === "all"
      ? "No property-level documents"
      : `No ${cat} at property level`;
  }
  const place = opts.locationLabel ?? "this location";
  return opts.category === "all"
    ? `No documents are filed to ${place}`
    : `No ${cat} are filed to ${place}`;
}
