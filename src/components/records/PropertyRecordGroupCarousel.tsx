import { SpaceGroupCarousel } from "@/components/spaces/SpaceGroupCarousel";
import { RecordGroupCard } from "@/components/records/RecordGroupCard";
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
      return { group, count: items.length };
    }
    if (group.id === "uncategorised") {
      const items = documents.filter(
        (d) =>
          !d.category &&
          matchesSearch(`${d.title ?? ""} ${d.file_name ?? ""}`, q)
      );
      return { group, count: items.length };
    }
    const items = documents.filter(
      (d) =>
        d.category === group.id &&
        matchesSearch(`${d.title ?? ""} ${d.file_name ?? ""} ${d.category ?? ""}`, q)
    );
    return { group, count: items.length };
  }).filter((row) => !q || row.count > 0 || row.group.id === selectedGroupId);

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-sm text-muted-foreground">
        Browse by category — select a group to focus the directory below.
      </p>
      <SpaceGroupCarousel>
        {groups.map(({ group, count }) => (
          <RecordGroupCard
            key={group.id}
            group={group}
            count={count}
            selected={selectedGroupId === group.id}
            onSelect={() =>
              onSelectGroup(selectedGroupId === group.id ? null : group.id)
            }
          />
        ))}
      </SpaceGroupCarousel>
    </div>
  );
}
