/**
 * CreateTaskRow - Single row in the vertical Create Task stack.
 *
 * Authoritative layout:
 * - Default: single-line height, icon on far left, no visible title, no "+"
 * - Hover: row expands, instruction text appears (clickable); icon outside hover surface
 * - Active: instruction becomes inline input in same row; focus in input
 * - Chips (fact + suggested) inline to the right of instruction/input
 * - No cards, tabs, accordions; compact vertical spacing.
 */

import React, { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/chips/Chip";
import type { SuggestedChip } from "@/types/chip-suggestions";

export interface CreateTaskRowProps {
  sectionId: string;
  icon: React.ReactNode;
  instruction: string;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate?: () => void;
  /** When active: inline input or picker content (single line) */
  children?: React.ReactNode;
  /** Fact chips for this section (resolved / committed) */
  factChips: SuggestedChip[];
  /** Suggested (AI) chips for this section */
  suggestedChips?: SuggestedChip[];
  onChipRemove?: (chip: SuggestedChip) => void;
  onSuggestionClick?: (chip: SuggestedChip) => void;
  /** Optional unresolved marker (e.g. amber dot) */
  hasUnresolved?: boolean;
}

export function CreateTaskRow({
  sectionId,
  icon,
  instruction,
  isActive,
  onActivate,
  onDeactivate,
  children,
  factChips,
  suggestedChips = [],
  onChipRemove,
  onSuggestionClick,
  hasUnresolved = false,
}: CreateTaskRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Focus input when row becomes active (children may contain an input)
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    const input = containerRef.current.querySelector<HTMLInputElement>("input, [data-focus-inline]");
    if (input) {
      const t = setTimeout(() => input.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isActive]);

  const showInstruction = isActive || isHovered;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "flex items-center gap-2 min-h-[32px] mt-0 py-0 rounded-[8px] transition-all duration-200",
        !isActive && "hover:bg-muted/30"
      )}
    >
      {/* Icon on far left - outside hover/click surface */}
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-[8px] bg-background",
          isActive && "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] bg-card"
        )}
      >
        {icon}
      </div>

      {/* Hover surface: instruction visible only on hover (or when active show children) */}
      <button
        type="button"
        onClick={() => {
          if (!isActive) onActivate();
        }}
        className={cn(
          "flex-1 min-w-0 flex items-center gap-2 text-left rounded-[8px] px-2 py-1.5",
          "transition-all duration-200",
          !isActive && "cursor-pointer",
          isActive && "cursor-default"
        )}
      >
        {isActive ? (
          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
            {children}
          </div>
        ) : (
          <span
            className={cn(
              "text-[12px] font-mono uppercase tracking-wider text-muted-foreground truncate transition-opacity duration-200",
              showInstruction ? "opacity-100" : "opacity-0"
            )}
          >
            {instruction}
          </span>
        )}
      </button>

      {/* Fact chips + suggested chips inline to the right of instruction/input */}
      <div className="flex flex-shrink-0 items-center gap-1.5 flex-wrap">
        {factChips.map((chip) => {
          const isAIPreFilled = chip.resolvedEntityId && (chip.source === "rule" || chip.source === "ai" || chip.source === "fallback");
          return (
            <Chip
              key={chip.id}
              role="fact"
              label={chip.label.toUpperCase()}
              onRemove={onChipRemove ? () => onChipRemove(chip) : undefined}
              aiPreFilled={isAIPreFilled}
              animate={false}
              className="font-mono text-[11px] rounded-[8px] h-[24px] bg-white"
            />
          );
        })}
        {suggestedChips.map((chip) => (
          <Chip
            key={chip.id}
            role="suggestion"
            label={chip.label.toUpperCase()}
            onSelect={onSuggestionClick ? () => onSuggestionClick(chip) : undefined}
            animate={false}
            className="font-mono text-[11px] rounded-[8px] h-[24px] border-2 border-dashed border-muted-foreground/50 bg-transparent"
          />
        ))}
      </div>

      {hasUnresolved && !isActive && (
        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 border border-background" />
      )}
    </div>
  );
}
