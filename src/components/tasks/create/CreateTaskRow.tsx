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
import { ChipStrip } from "@/components/chips/ChipStrip";
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

  // When clicking the instruction, enter inline-editing mode and activate the section
  const handleInstructionClick = () => {
    if (!isActive) onActivate();
    setIsInlineEditing(true);
    setInlineValue("");
  };

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

  const showInstruction = isActive || isHovered;

  // Convert to ChipData and merge for ChipStrip (contract: fact, interactive only)
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
    return [...facts, ...verbs, ...suggested];
  }, [factChips, verbChips, suggestedChips]);

  const handleChipPress = (chip: ChipData) => {
    if (chip.variant === "fact") {
      onActivate();
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
            isActive && "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] bg-card"
          )}
        >
          {icon}
        </div>

        {/* ChipStrip: fact + interactive only (no ghost, no third surface) */}
        {chipData.length > 0 && (
          <div className="flex flex-shrink-0 items-center min-w-0">
            <ChipStrip
              chips={chipData}
              onChipPress={handleChipPress}
              onChipRemove={handleChipRemove}
              className="shrink-0"
            />
          </div>
        )}

        {/* Instruction text / inline input - clickable to activate and become an input */}
        {isInlineEditing ? (
          <div className="flex-1 min-w-0 px-1">
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
              }}
              onBlur={() => {
                // Small delay so click events on children can fire first
                setTimeout(() => {
                  setIsInlineEditing(false);
                  setInlineValue("");
                }, 200);
              }}
              placeholder={instruction}
              className="w-full bg-transparent text-[12px] font-mono uppercase tracking-wider text-foreground placeholder:text-muted-foreground/50 outline-none border-b border-muted-foreground/30 focus:border-primary py-1"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleInstructionClick}
            className={cn(
              "flex-1 min-w-0 flex items-center gap-2 text-left rounded-[8px] px-2 py-1.5",
              "transition-all duration-200",
              "cursor-pointer"
            )}
          >
            <span
              className={cn(
                "text-[12px] font-mono uppercase tracking-normal text-muted-foreground truncate transition-opacity duration-200",
                showInstruction ? "opacity-100" : "opacity-0"
              )}
            >
              {instruction}
            </span>
          </button>
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
