import { formatDistanceToNow } from "date-fns";
import { FileText, Shield } from "lucide-react";
import { WorkspaceSectionHeading } from "@/components/property-workspace";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import type { ComplianceRecord } from "@/components/records/complianceRecordModel";
import { cn } from "@/lib/utils";

type RecentItem = {
  id: string;
  kind: "document" | "compliance";
  title: string;
  subtitle: string;
  at: string;
};

type PropertyRecentRecordsListProps = {
  documents: PropertyDocument[];
  complianceRecords: ComplianceRecord[];
  onOpenDocument?: (id: string) => void;
  onOpenCompliance?: (id: string) => void;
  className?: string;
  limit?: number;
};

export function PropertyRecentRecordsList({
  documents,
  complianceRecords,
  onOpenDocument,
  onOpenCompliance,
  className,
  limit = 8,
}: PropertyRecentRecordsListProps) {
  const items: RecentItem[] = [
    ...documents.map((d) => ({
      id: d.id,
      kind: "document" as const,
      title: d.title?.trim() || d.file_name?.trim() || "Untitled document",
      subtitle: d.category?.trim() || "Document",
      at: d.created_at || d.updated_at || "",
    })),
    ...complianceRecords.map((r) => ({
      id: r.id,
      kind: "compliance" as const,
      title: r.title,
      subtitle: r.complianceType || "Compliance",
      at: r.nextDueDate || r.expiryDate || "",
    })),
  ]
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);

  return (
    <div className={cn("space-y-2", className)}>
      <WorkspaceSectionHeading>Recent</WorkspaceSectionHeading>
      {items.length === 0 ? (
        <p className="rounded-xl bg-card/70 px-3 py-4 text-xs text-muted-foreground shadow-e1">
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
                  className="flex w-full items-center gap-2.5 rounded-xl bg-card/80 px-3 py-2 text-left shadow-e1 transition-shadow hover:shadow-md"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden />
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
