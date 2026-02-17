import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FilterChip } from "@/components/chips/filter";
import { cn } from "@/lib/utils";

interface DocumentSearchFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  expiringSoon: boolean;
  expired: boolean;
  missing: boolean;
  recentlyAdded: boolean;
  hazards?: boolean;
  unlinked?: boolean;
  onExpiringSoonToggle: () => void;
  onExpiredToggle: () => void;
  onMissingToggle: () => void;
  onRecentlyAddedToggle: () => void;
  onHazardsToggle?: () => void;
  onUnlinkedToggle?: () => void;
  className?: string;
}

export function DocumentSearchFilters({
  search,
  onSearchChange,
  expiringSoon,
  expired,
  missing,
  recentlyAdded,
  hazards,
  unlinked,
  onExpiringSoonToggle,
  onExpiredToggle,
  onMissingToggle,
  onRecentlyAddedToggle,
  onHazardsToggle,
  onUnlinkedToggle,
  className,
}: DocumentSearchFiltersProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 rounded-[8px]"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="Expiring soon"
          selected={expiringSoon}
          onSelect={onExpiringSoonToggle}
        />
        <FilterChip
          label="Expired"
          selected={expired}
          onSelect={onExpiredToggle}
          color={expired ? "hsl(var(--destructive))" : undefined}
        />
        <FilterChip
          label="Missing"
          selected={missing}
          onSelect={onMissingToggle}
        />
        <FilterChip
          label="Recently added"
          selected={recentlyAdded}
          onSelect={onRecentlyAddedToggle}
        />
        {onHazardsToggle && (
          <FilterChip
            label="Hazards"
            selected={!!hazards}
            onSelect={onHazardsToggle}
            color={hazards ? "hsl(var(--warning))" : undefined}
          />
        )}
        {onUnlinkedToggle && (
          <FilterChip
            label="Unlinked"
            selected={!!unlinked}
            onSelect={onUnlinkedToggle}
          />
        )}
      </div>
    </div>
  );
}
