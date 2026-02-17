import { FilterChip } from "@/components/chips/filter";
import { DOCUMENT_CATEGORIES } from "@/hooks/property/usePropertyDocuments";
import { cn } from "@/lib/utils";

interface DocumentCategoryChipsProps {
  selected: string | null;
  onSelect: (category: string | null) => void;
  className?: string;
}

export function DocumentCategoryChips({
  selected,
  onSelect,
  className,
}: DocumentCategoryChipsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {DOCUMENT_CATEGORIES.map((cat) => (
        <FilterChip
          key={cat}
          label={cat}
          selected={selected === cat}
          onSelect={() => onSelect(selected === cat ? null : cat)}
        />
      ))}
    </div>
  );
}
