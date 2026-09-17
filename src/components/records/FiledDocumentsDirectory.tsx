import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import { RecordDocumentRow } from "@/components/records/RecordDocumentRow";
import { isPropertyLevelDocument } from "@/lib/records/attachmentSpaces";
import { cn } from "@/lib/utils";
import { getRecordGroup, type RecordGroupId } from "@/lib/records/recordGroups";
import { List } from "lucide-react";

type FiledDocumentsDirectoryProps = {
  documents: PropertyDocument[];
  groupFilter?: RecordGroupId | null;
  searchQuery?: string;
  filingEnabled: boolean;
  /** When true, only property-level (no space links) docs. */
  propertyLevelOnly?: boolean;
  heading?: string;
  onOpenDocument: (id: string) => void;
  onFileTo: (doc: PropertyDocument) => void;
  onRemoveSpaceLink: (
    doc: PropertyDocument,
    spaceId: string,
    spaceName: string
  ) => void;
  onDownload: (doc: PropertyDocument) => void;
  onDelete?: (doc: PropertyDocument) => void;
  className?: string;
};

function matchesGroup(doc: PropertyDocument, groupFilter: RecordGroupId | null | undefined) {
  if (!groupFilter || groupFilter === "compliance") return groupFilter !== "compliance";
  if (groupFilter === "uncategorised") return !doc.category;
  return doc.category === groupFilter;
}

function matchesSearch(doc: PropertyDocument, q: string) {
  if (!q.trim()) return true;
  const hay = `${doc.title ?? ""} ${doc.file_name ?? ""} ${doc.category ?? ""}`.toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}

/**
 * Vertical document directory for Records filing — documents only (no compliance chips).
 */
export function FiledDocumentsDirectory({
  documents,
  groupFilter = null,
  searchQuery = "",
  filingEnabled,
  propertyLevelOnly = false,
  heading,
  onOpenDocument,
  onFileTo,
  onRemoveSpaceLink,
  onDownload,
  onDelete,
  className,
}: FiledDocumentsDirectoryProps) {
  const q = searchQuery.trim().toLowerCase();
  const selectedGroup = groupFilter ? getRecordGroup(groupFilter) : undefined;
  const HeadingIcon = selectedGroup?.icon ?? List;
  const headingLabel =
    heading ??
    (propertyLevelOnly
      ? "Property-level documents"
      : selectedGroup && selectedGroup.id !== "compliance"
        ? selectedGroup.label
        : "All documents");

  const rows = documents
    .filter((d) => matchesGroup(d, groupFilter === "compliance" ? null : groupFilter))
    .filter((d) => (propertyLevelOnly ? isPropertyLevelDocument(d) : true))
    .filter((d) => matchesSearch(d, q))
    .slice()
    .sort((a, b) =>
      documentDisplaySortKey(a).localeCompare(documentDisplaySortKey(b))
    );

  if (propertyLevelOnly && rows.length === 0) return null;

  return (
    <section className={cn("space-y-3", className)} aria-labelledby={`filed-docs-${propertyLevelOnly ? "property" : "all"}`}>
      <div className="flex min-w-0 items-center gap-2">
        <div
          className="rounded-xl bg-primary p-2.5"
          style={{
            boxShadow: "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)",
          }}
        >
          <HeadingIcon className="h-5 w-5 text-white" aria-hidden />
        </div>
        <h2
          id={`filed-docs-${propertyLevelOnly ? "property" : "all"}`}
          className="text-lg font-semibold text-foreground"
        >
          {headingLabel}
        </h2>
        <span
          className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-white px-1.5 text-caption font-medium tabular-nums text-muted-foreground shadow-e1"
          aria-label={`${rows.length} documents`}
        >
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">
          {q ? "No documents match your search." : "No documents in this group yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((doc) => (
            <li key={doc.id}>
              <RecordDocumentRow
                document={doc}
                filingEnabled={filingEnabled}
                onOpen={() => onOpenDocument(doc.id)}
                onEdit={() => onOpenDocument(doc.id)}
                onFileTo={() => onFileTo(doc)}
                onDownload={() => onDownload(doc)}
                onDelete={onDelete ? () => onDelete(doc) : undefined}
                onRemoveSpaceLink={(spaceId, spaceName) =>
                  onRemoveSpaceLink(doc, spaceId, spaceName)
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function documentDisplaySortKey(doc: PropertyDocument): string {
  return (doc.title?.trim() || doc.file_name?.trim() || "").toLowerCase();
}
