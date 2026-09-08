import { formatDistanceToNow } from "date-fns";
import { FileText, Shield } from "lucide-react";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import type { ComplianceRecord } from "@/components/records/complianceRecordModel";
import { getRecordGroup } from "@/lib/records/recordGroups";
import { cn } from "@/lib/utils";

type RecentItem = {
  id: string;
  kind: "document" | "compliance";
  title: string;
  subtitle: string;
  at: string;
  accent: string;
};

type PropertyRecentRecordsListProps = {
  documents: PropertyDocument[];
  complianceRecords: ComplianceRecord[];
  onOpenDocument?: (id: string) => void;
  onOpenCompliance?: (id: string) => void;
  className?: string;
  limit?: number;
  /** When true, omit the section title (parent surface already labels it). */
  headless?: boolean;
};

/**
 * Recent records list — same row language as PropertySpacesList (thumb + name + caption).
 */
export function PropertyRecentRecordsList({
  documents,
  complianceRecords,
  onOpenDocument,
  onOpenCompliance,
  className,
  limit = 8,
  headless = false,
}: PropertyRecentRecordsListProps) {
  const items: RecentItem[] = [
    ...documents.map((d) => {
      const group = d.category ? getRecordGroup(d.category) : undefined;
      return {
        id: d.id,
        kind: "document" as const,
        title: d.title?.trim() || d.file_name?.trim() || "Untitled document",
        subtitle: d.category?.trim() || "Document",
        at: d.created_at || d.updated_at || "",
        accent: group?.color ?? "#ADB5BD",
      };
    }),
    ...complianceRecords.map((r) => {
      const group = getRecordGroup("compliance");
      return {
        id: r.id,
        kind: "compliance" as const,
        title: r.title,
        subtitle: r.complianceType || "Compliance",
        at: r.nextDueDate || r.expiryDate || "",
        accent: group?.color ?? "#8EC9CE",
      };
    }),
  ]
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);

  return (
    <div className={cn("space-y-2", className)}>
      {!headless ? (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h3 className="text-sm font-semibold text-foreground">Recent records</h3>
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="rounded-card bg-card/70 px-3 py-4 text-xs text-muted-foreground shadow-e1">
          Recent documents and obligations will appear here.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const Icon = item.kind === "compliance" ? Shield : FileText;
            return (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  type="button"
                  onClick={() =>
                    item.kind === "document"
                      ? onOpenDocument?.(item.id)
                      : onOpenCompliance?.(item.id)
                  }
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-card bg-card/70 px-2.5 py-2 text-left shadow-e1",
                    "transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  )}
                >
                  <span
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: item.accent }}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.subtitle}
                      {item.at
                        ? ` · ${formatDistanceToNow(new Date(item.at), { addSuffix: true })}`
                        : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
