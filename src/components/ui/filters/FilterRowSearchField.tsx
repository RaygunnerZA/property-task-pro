import { cn } from "@/lib/utils";

type FilterRowSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

/**
 * Pressed search field that sits in the [FILTER] [SORT] [SEARCH] chip row.
 * Same footprint as FilterChip / SORT (28px) so the row stays one line and scrolls.
 */
export function FilterRowSearchField({
  value,
  onChange,
  placeholder = "Search",
  className,
}: FilterRowSearchFieldProps) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={cn(
        "h-[28px] min-w-[120px] max-w-[220px] flex-1 rounded-[8px] px-2.5",
        "font-mono text-2xs uppercase tracking-wide leading-none text-foreground",
        "placeholder:text-muted-foreground",
        "bg-background",
        "shadow-[inset_1px_2px_4px_rgba(0,0,0,0.12),inset_-1px_-1px_2px_rgba(255,255,255,0.55)]",
        "outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
        className
      )}
    />
  );
}
