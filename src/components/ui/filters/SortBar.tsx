import React, { useEffect, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterChip } from "@/components/chips/filter";
import type { WorkbenchSortBy } from "@/contexts/WorkbenchControlsContext";

export type SortOption = {
  id: WorkbenchSortBy;
  label: string;
};

const DEFAULT_SORT_OPTIONS: SortOption[] = [
  { id: "recent", label: "Recent" },
  { id: "title", label: "A-Z" },
  { id: "priority", label: "Priority" },
];

type SortBarProps = {
  sortBy: WorkbenchSortBy;
  onSortChange: (sort: WorkbenchSortBy) => void;
  options?: SortOption[];
  className?: string;
  /** Collapse when a peer control expands (e.g. Filter opens categories). */
  forceCollapsed?: boolean;
};

/**
 * Sort control — sits beside FILTER; click expands options to the right.
 * Collapsed: [SORT]
 * Expanded:  [SORT] [Recent] [A-Z] [Priority]
 */
export function SortBar({
  sortBy,
  onSortChange,
  options = DEFAULT_SORT_OPTIONS,
  className,
  forceCollapsed = false,
}: SortBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<"right-to-left" | "left-to-right" | null>(
    null
  );

  useEffect(() => {
    if (!forceCollapsed || !expanded) return;
    setAnimationDirection("right-to-left");
    setExpanded(false);
  }, [forceCollapsed, expanded]);

  useEffect(() => {
    if (!animationDirection) return;
    const timer = setTimeout(() => setAnimationDirection(null), 300);
    return () => clearTimeout(timer);
  }, [animationDirection, expanded]);

  const handleSortClick = () => {
    if (expanded) {
      setAnimationDirection("right-to-left");
      setExpanded(false);
      return;
    }
    setAnimationDirection("left-to-right");
    setExpanded(true);
  };

  const handleSelect = (id: WorkbenchSortBy) => {
    onSortChange(id);
  };

  const wipeClass =
    animationDirection === "right-to-left"
      ? "animate-[wipe-right-to-left_0.2s_ease-out_both]"
      : animationDirection === "left-to-right"
        ? "animate-[wipe-left-to-right_0.2s_ease-out_both]"
        : "";

  return (
    <div className={cn("inline-flex items-center gap-[5px] flex-nowrap", className)}>
      <button
        type="button"
        data-sort-primary-trigger
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleSortClick}
        aria-expanded={expanded}
        aria-label={expanded ? "Sort — collapse options" : "Sort — open options"}
        title="Sort"
        className={cn(
          "inline-flex items-center justify-start gap-1.5 py-1 pl-2 pr-2.5 rounded-[8px] flex-shrink-0 overflow-hidden h-6",
          "font-mono text-[11px] uppercase tracking-wider",
          "select-none cursor-pointer",
          "bg-background",
          expanded
            ? "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] bg-card"
            : "shadow-[1px_2px_2px_0px_rgba(0,0,0,0.15),-1px_-2px_2px_0px_rgba(255,255,255,0.9)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] hover:bg-card"
        )}
        style={{ letterSpacing: "0.325px" }}
      >
        <ArrowUpDown className="h-[14px] w-[14px] text-foreground shrink-0" />
        <span className="whitespace-nowrap">SORT</span>
      </button>

      {expanded ? (
        <div className={cn("inline-flex items-center gap-[5px] flex-nowrap", wipeClass)}>
          {options.map((option) => (
            <FilterChip
              key={option.id}
              label={option.label}
              selected={sortBy === option.id}
              onSelect={() => handleSelect(option.id)}
              className="h-[24px] !duration-300 ease-out"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
