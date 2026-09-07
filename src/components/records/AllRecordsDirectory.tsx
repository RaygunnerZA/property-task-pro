import { useMemo, useState } from "react";
import { WorkspaceSectionHeading } from "@/components/property-workspace";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import type { ComplianceRecord } from "@/components/records/complianceRecordModel";
import type { RecordGroupId } from "@/lib/records/recordGroups";
import { cn } from "@/lib/utils";

type AllRecordsDirectoryProps = {
  documents: PropertyDocument[];
  complianceRecords: ComplianceRecord[];
  groupFilter?: RecordGroupId | null;
  searchQuery?: string;
  onOpenDocument?: (id: string) => void;
  onOpenCompliance?: (id: string) => void;
  className?: string;
};

type DirectoryRow = {
  id: string;
  kind: "document" | "compliance";
  label: string;
  meta: string;
  at: string;
};

type SortId = "name" | "recent" | "group";

const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "recent", label: "Recent" },
  { id: "group", label: "Group" },
];

export function AllRecordsDirectory({
  documents,
  complianceRecords,
  groupFilter = null,
  searchQuery = "",
  onOpenDocument,
  onOpenCompliance,
  className,
}: AllRecordsDirectoryProps) {
  const [sort, setSort] = useState<SortId>("name");
  const q = searchQuery.trim().toLowerCase();

  const rows = useMemo(() => {
    const docRows: DirectoryRow[] = documents
      .filter((d) => {
        if (groupFilter === "compliance") return false;
        if (groupFilter === "uncategorised") return !d.category;
        if (groupFilter) return d.category === groupFilter;
        return true;
      })
      .filter((d) => {
        if (!q) return true;
        return `${d.title ?? ""} ${d.file_name ?? ""} ${d.category ?? ""}`
          .toLowerCase()
          .includes(q);
      })
      .map((d) => ({
        id: d.id,
        kind: "document" as const,
        label: d.title?.trim() || d.file_name?.trim() || "Untitled document",
        meta: d.category?.trim() || "Uncategorised",
        at: d.created_at || d.updated_at || "",
      }));

    const complianceRows: DirectoryRow[] = (
      !groupFilter || groupFilter === "compliance" ? complianceRecords : []
    )
      .filter((r) => {
        if (!q) return true;
        return `${r.title} ${r.complianceType} ${r.propertyName}`
          .toLowerCase()
          .includes(q);
      })
      .map((r) => ({
        id: r.id,
        kind: "compliance" as const,
        label: r.title,
        meta: r.complianceType || "Compliance",
        at: r.nextDueDate || r.expiryDate || "",
      }));

    const merged = [...docRows, ...complianceRows];
    if (sort === "name") {
      return merged.sort((a, b) => a.label.localeCompare(b.label));
    }
    if (sort === "group") {
      return merged.sort(
        (a, b) => a.meta.localeCompare(b.meta) || a.label.localeCompare(b.label)
      );
    }
    return merged.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );
  }, [documents, complianceRecords, groupFilter, q, sort]);

  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <WorkspaceSectionHeading className="mb-0">All records</WorkspaceSectionHeading>
        <div className="flex gap-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSort(opt.id)}
              className={cn(
                "rounded-lg px-2 py-1 text-2xs font-medium transition-colors",
                sort === opt.id
                  ? "bg-card text-foreground shadow-e1"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-4 text-xs text-muted-foreground">
          {q ? "No records match your search." : "No records in this group yet."}
        </p>
      ) : (
        <ul className="columns-1 gap-x-4 sm:columns-2 [column-fill:_balance]">
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`} className="mb-1 break-inside-avoid">
              <button
                type="button"
                onClick={() =>
                  row.kind === "document"
                    ? onOpenDocument?.(row.id)
                    : onOpenCompliance?.(row.id)
                }
                className="flex w-full items-baseline justify-between gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-muted/40"
              >
                <span className="min-w-0 truncate text-sm text-foreground">{row.label}</span>
                <span className="shrink-0 text-2xs text-muted-foreground">{row.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
