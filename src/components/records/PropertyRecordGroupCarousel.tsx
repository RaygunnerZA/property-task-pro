import { SpaceGroupCarousel } from "@/components/spaces/SpaceGroupCarousel";
import {
  RECORD_GROUPS,
  type RecordGroupId,
} from "@/lib/records/recordGroups";
import { cn } from "@/lib/utils";
import type { PropertyDocument } from "@/hooks/property/usePropertyDocuments";
import type { ComplianceRecord } from "@/components/records/complianceRecordModel";

type PropertyRecordGroupCarouselProps = {
  documents: PropertyDocument[];
  complianceRecords: ComplianceRecord[];
  selectedGroupId: RecordGroupId | null;
  onSelectGroup: (groupId: RecordGroupId | null) => void;
  searchQuery?: string;
  className?: string;
};

function matchesSearch(haystack: string, query: string): boolean {
  if (!query.trim()) return true;
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

export function PropertyRecordGroupCarousel({
  documents,
  complianceRecords,
  selectedGroupId,
  onSelectGroup,
  searchQuery = "",
  className,
}: PropertyRecordGroupCarouselProps) {
  const q = searchQuery.trim().toLowerCase();

  const groups = RECORD_GROUPS.map((group) => {
    if (group.id === "compliance") {
      const items = complianceRecords.filter((r) =>
        matchesSearch(`${r.title} ${r.complianceType} ${r.propertyName}`, q)
      );
      return { group, count: items.length, previews: items.slice(0, 4).map((r) => r.title) };
    }
    if (group.id === "uncategorised") {
      const items = documents.filter(
        (d) =>
          !d.category &&
          matchesSearch(`${d.title ?? ""} ${d.file_name ?? ""}`, q)
      );
      return {
        group,
        count: items.length,
        previews: items
          .slice(0, 4)
          .map((d) => d.title?.trim() || d.file_name?.trim() || "Untitled"),
      };
    }
    const items = documents.filter(
      (d) =>
        d.category === group.id &&
        matchesSearch(`${d.title ?? ""} ${d.file_name ?? ""} ${d.category ?? ""}`, q)
    );
    return {
      group,
      count: items.length,
      previews: items
        .slice(0, 4)
        .map((d) => d.title?.trim() || d.file_name?.trim() || "Untitled"),
    };
  }).filter((row) => !q || row.count > 0 || row.group.id === selectedGroupId);

  return (
    <SpaceGroupCarousel className={className}>
      {groups.map(({ group, count, previews }) => {
        const Icon = group.icon;
        const selected = selectedGroupId === group.id;
        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelectGroup(selected ? null : group.id)}
            className={cn(
              "flex h-full w-[210px] shrink-0 flex-col overflow-hidden rounded-xl bg-card/80 p-3.5 text-left shadow-e1 transition-all",
              "hover:-translate-y-0.5 hover:shadow-e2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              selected && "ring-2 ring-primary/50"
            )}
          >
            <div
              className="mb-3 h-1.5 w-12 rounded-full"
              style={{ backgroundColor: group.color }}
              aria-hidden
            />
            <div className="mb-2 flex items-center gap-2">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: group.color }}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
                {group.label}
              </h3>
            </div>
            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
              {group.description}
            </p>
            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
              {count}
            </p>
            <p className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
              {count === 1 ? "record" : "records"}
            </p>
            <ul className="mt-auto space-y-1 pt-3">
              {previews.length === 0 ? (
                <li className="text-xs text-muted-foreground/80">Nothing here yet</li>
              ) : (
                previews.map((label) => (
                  <li
                    key={label}
                    className="truncate text-xs text-muted-foreground"
                    title={label}
                  >
                    {label}
                  </li>
                ))
              )}
            </ul>
          </button>
        );
      })}
    </SpaceGroupCarousel>
  );
}
