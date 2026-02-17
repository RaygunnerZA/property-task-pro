/**
 * CreateTaskRow - Single row in the vertical Create Task stack.
 *
 * Authoritative layout:
 * - Default: single-line height, icon on far left, instruction on hover
 * - Active: icon + row stay at TOP, expanded content appears on rows BELOW
 * - Chips (fact + suggested) inline to the right of icon
 * - Vertical expansion downward, not centered
 */

import React, { useRef, useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { SemanticChipStrip } from "@/components/chips/semantic";
import { suggestedChipToChipData } from "@/lib/task-chip-utils";
import type { ChipData } from "@/types/task-chip";
import type { SuggestedChip } from "@/types/chip-suggestions";

export interface CreateTaskRowProps {
  sectionId: string;
  icon: React.ReactNode;
  instruction: string;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate?: () => void;
  /** When active: expanded content appears on rows below */
  children?: React.ReactNode;
  /** Fact chips for this section (resolved / committed) */
  factChips: SuggestedChip[];
  /** Suggested (AI) chips for this section */
  suggestedChips?: SuggestedChip[];
  /** Verb chips for this section (unresolved actions like "INVITE FRANK", "ADD COTTAGE") */
  verbChips?: SuggestedChip[];
  onChipRemove?: (chip: SuggestedChip) => void;
  onSuggestionClick?: (chip: SuggestedChip) => void;
  /** Handler for verb chip clicks (resolve actions) */
  onVerbChipClick?: (chip: SuggestedChip) => void;
  /** Optional unresolved marker (e.g. amber dot) */
  hasUnresolved?: boolean;
  /** Callback when the user types into the inline instruction input */
  onInlineSearch?: (query: string) => void;
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
  verbChips = [],
  onChipRemove,
  onSuggestionClick,
  onVerbChipClick,
  hasUnresolved = false,
  onInlineSearch,
}: CreateTaskRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineValue, setInlineValue] = useState("");

  // Focus the inline input when entering edit mode
  useEffect(() => {
    if (isInlineEditing && inlineInputRef.current) {
      const t = setTimeout(() => inlineInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isInlineEditing]);

  // Reset inline editing when deactivated
  useEffect(() => {
    if (!isActive) {
      setIsInlineEditing(false);
      setInlineValue("");
    }
  }, [isActive]);

  // Focus input when row becomes active (children may contain an input)
  useEffect(() => {
    if (!isActive || isInlineEditing || !containerRef.current) return;
    const input = containerRef.current.querySelector<HTMLInputElement>("input:not([data-inline-instruction]), [data-focus-inline]");
    if (input) {
      const t = setTimeout(() => input.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isActive, isInlineEditing]);

  // Convert to ChipData and merge for ChipStrip (contract: fact, interactive only)
  // Instruction chip appears only on hover, to the right of any tags
  const chipData = useMemo((): ChipData[] => {
    const facts: ChipData[] = factChips.map((c) =>
      suggestedChipToChipData(c)
    );
    const verbs: ChipData[] = verbChips.map((c) =>
      suggestedChipToChipData(c, { verbLabel: c.label })
    );
    const suggested: ChipData[] = suggestedChips.map((c) =>
      suggestedChipToChipData(c)
    );
    const instructionChip: ChipData = {
      id: `instruction-${sectionId}`,
      label: instruction.toUpperCase(),
      variant: "interactive",
      kind: "instruction",
    };
    return isHovered
      ? [...facts, ...verbs, ...suggested, instructionChip]
      : [...facts, ...verbs, ...suggested];
  }, [factChips, verbChips, suggestedChips, sectionId, instruction, isHovered]);

  const handleChipPress = (chip: ChipData) => {
    if (chip.variant === "fact") {
      onActivate();
      return;
    }
    // Instruction chip: enter inline editing (click → becomes text field)
    if (chip.variant === "interactive" && chip.kind === "instruction") {
      if (!isActive) onActivate();
      setIsInlineEditing(true);
      setInlineValue("");
      return;
    }
    const original = [...verbChips, ...suggestedChips].find((c) => c.id === chip.id);
    if (!original) return;
    if (chip.variant === "interactive" && chip.blocking) {
      onVerbChipClick?.(original);
    } else {
      onSuggestionClick?.(original);
    }
  };

  const handleChipRemove = (chip: ChipData) => {
    const original = factChips.find((c) => c.id === chip.id);
    if (original && onChipRemove) onChipRemove(original);
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "flex flex-col rounded-[8px] transition-all duration-200",
        !isActive && "hover:bg-muted/30"
      )}
    >
      {/* Primary row: Icon + Chips + Instruction (always at top) */}
      <div className="flex items-center gap-0 min-h-[32px]">
        {/* Icon on far left - outside hover/click surface */}
        <div
          className={cn(
            "flex-shrink-0 flex items-center justify-center w-[32px] h-8 -ml-[1px] rounded-[8px] bg-background",
            isActive && "shadow-inset bg-card"
          )}
        >
          {icon}
        </div>

        {/* ChipStrip: fact + interactive chips; instruction chip on hover, to the right of tags */}
        {isInlineEditing ? (
          <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
            <input
              ref={inlineInputRef}
              data-inline-instruction
              type="text"
              value={inlineValue}
              onChange={(e) => {
                setInlineValue(e.target.value);
                onInlineSearch?.(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsInlineEditing(false);
                  setInlineValue("");
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  onInlineSearch?.(inlineValue);
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  setIsInlineEditing(false);
                  setInlineValue("");
                }, 200);
              }}
              placeholder={instruction}
              className={cn(
                "h-[28px] min-w-[80px] flex-1 rounded-[8px] px-2 py-1",
                "font-mono text-[11px] uppercase tracking-wide",
                "bg-background text-muted-foreground/70 placeholder:text-muted-foreground/50",
                "shadow-inset",
                "outline-none cursor-text",
                "transition-[min-width] duration-300 ease-out"
              )}
            />
          </div>
        ) : (
          <div className="flex flex-shrink-0 items-center min-w-0 flex-1 pl-1">
            <SemanticChipStrip
              chips={chipData}
              onChipPress={handleChipPress}
              onChipRemove={handleChipRemove}
              className="shrink-0"
            />
          </div>
        )}

        {hasUnresolved && !isActive && (
          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 border border-background" />
        )}
      </div>

      {/* Expanded content: appears on rows BELOW when active */}
      {isActive && children && (
        <div className="pl-[22px] pt-2 pb-2">
          {children}
        </div>
      )}
    </div>
  );
}
