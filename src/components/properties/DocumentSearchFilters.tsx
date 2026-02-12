import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/chips/Chip";
import { cn } from "@/lib/utils";

interface DocumentSearchFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  expiringSoon: boolean;
  expired: boolean;
  missing: boolean;
  recentlyAdded: boolean;
  onExpiringSoonToggle: () => void;
  onExpiredToggle: () => void;
  onMissingToggle: () => void;
  onRecentlyAddedToggle: () => void;
  className?: string;
}

export function DocumentSearchFilters({
  search,
  onSearchChange,
  expiringSoon,
  expired,
  missing,
  recentlyAdded,
  onExpiringSoonToggle,
  onExpiredToggle,
  onMissingToggle,
  onRecentlyAddedToggle,
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
        <Chip
          role="filter"
          label="Expiring soon"
          selected={expiringSoon}
          onSelect={onExpiringSoonToggle}
        />
        <Chip
          role="filter"
          label="Expired"
          selected={expired}
          onSelect={onExpiredToggle}
          color={expired ? "hsl(var(--destructive))" : undefined}
        />
        <Chip
          role="filter"
          label="Missing"
          selected={missing}
          onSelect={onMissingToggle}
        />
        <Chip
          role="filter"
          label="Recently added"
          selected={recentlyAdded}
          onSelect={onRecentlyAddedToggle}
        />
      </div>
    </div>
  );
}
