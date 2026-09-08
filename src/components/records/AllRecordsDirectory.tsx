import { useMemo, useState, type CSSProperties } from "react";
import { List } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  { id: "name", label: "A–Z" },
  { id: "recent", label: "Recently updated" },
  { id: "group", label: "By group" },
];

const COLUMN_STYLE: CSSProperties = {
  columnGap: "2.75rem",
  columnRule: "1px solid hsl(var(--border) / 0.35)",
};

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
    <section className={cn("space-y-3", className)} aria-labelledby="all-records-heading">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="rounded-xl bg-primary p-2.5"
            style={{
              boxShadow: "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)",
            }}
          >
            <List className="h-5 w-5 text-white" aria-hidden />
          </div>
          <h2 id="all-records-heading" className="text-lg font-semibold text-foreground">
            All records
          </h2>
          <span
            className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-white px-1.5 text-caption font-medium tabular-nums text-muted-foreground shadow-e1"
            aria-label={`${rows.length} records`}
          >
            {rows.length}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-2xs font-mono uppercase text-muted-foreground">Sort</span>
          <Select value={sort} onValueChange={(v) => setSort(v as SortId)}>
            <SelectTrigger
              className="h-7 w-[148px] border-0 bg-background/80 text-xs shadow-[inset_1px_2px_4px_rgba(0,0,0,0.06)] focus:ring-1 focus:ring-primary/40 focus:ring-offset-0"
              aria-label="Sort records"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.id} value={opt.id} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-xs text-muted-foreground">
          {q ? "No records match your search." : "No records in this group yet."}
        </p>
      ) : (
        <ul className="columns-2 list-none sm:columns-3" style={COLUMN_STYLE}>
          {rows.map((row) => (
            <li key={`${row.kind}-${row.id}`} className="mb-0.5 break-inside-avoid">
              <button
                type="button"
                onClick={() =>
                  row.kind === "document"
                    ? onOpenDocument?.(row.id)
                    : onOpenCompliance?.(row.id)
                }
                className={cn(
                  "flex w-full items-baseline gap-2 py-0.5 text-left text-xs leading-snug text-foreground/90",
                  "transition-colors hover:text-primary focus-visible:outline-none focus-visible:text-primary"
                )}
                title={`${row.label} · ${row.meta}`}
              >
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="shrink-0 text-caption text-muted-foreground">{row.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
