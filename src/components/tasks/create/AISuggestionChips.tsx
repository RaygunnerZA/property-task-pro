/**
 * AI Suggestion Chips — single horizontal strip.
 *
 * Layout: [FillaIcon] [CHIP] [CHIP] [+ INVITE X] [+ ADD Y]
 * Suggestion chips are gray (distinct from solid-white active fact chips in IntakeChipRow).
 * When a chip is selected it moves into the IntakeChipRow as a fact chip.
 */

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SuggestedChip, GhostGroup, ChipType } from '@/types/chip-suggestions';
import { FillaIcon } from '@/components/filla/FillaIcon';

interface AISuggestionChipsProps {
  chips: SuggestedChip[];
  ghostGroups: GhostGroup[];
  onChipSelect: (chip: SuggestedChip) => void;
  onGhostGroupSelect: (group: GhostGroup) => void;
  onChipRemove?: (chip: SuggestedChip) => void;
  /** When set, resolved (fact) chips are tappable to apply them to the form. */
  onFactChipPress?: (chip: SuggestedChip) => void;
  selectedChipIds?: string[];
  loading?: boolean;
  className?: string;
}

const FACT_CHIP_TYPES: ChipType[] = ['person', 'team', 'space', 'asset', 'category', 'date', 'recurrence'];

function verbLabel(chip: SuggestedChip): string {
  const raw = chip.value || chip.label;
  switch (chip.type) {
    case 'person': return `+ INVITE ${raw.toUpperCase()}`;
    case 'space':
    case 'asset': return `+ ADD ${raw.toUpperCase()}`;
    default: return `+ ${raw.toUpperCase()}`;
  }
}

export const AISuggestionChips: React.FC<AISuggestionChipsProps> = ({
  chips,
  onChipSelect,
  onChipRemove,
  onFactChipPress,
  loading = false,
  className,
}) => {
  if (loading) {
    return (
      <div className={cn('flex items-center gap-1.5 py-0.5', className)}>
        <FillaIcon size={11} className="text-[#EB6834] shrink-0 animate-pulse" />
        <span className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wide animate-pulse">
          Analyzing…
        </span>
      </div>
    );
  }

  const relevant = chips.filter(c => FACT_CHIP_TYPES.includes(c.type));
  const factChips = relevant.filter(c => c.resolvedEntityId || !c.blockingRequired);
  const verbChips = relevant.filter(c => c.blockingRequired && !c.resolvedEntityId);

  if (factChips.length === 0 && verbChips.length === 0) return null;

  const chipBase = cn(
    'group shrink-0 inline-flex items-center h-[22px] pl-[9px] pr-[9px] rounded-[7px]',
    'bg-foreground/[0.07] text-foreground/60',
    'font-mono text-[10px] uppercase tracking-wide whitespace-nowrap',
    'hover:bg-foreground/[0.12] hover:text-foreground/80 transition-all duration-150',
    'cursor-pointer select-none animate-in fade-in duration-200'
  );

  const renderChip = (
    chip: SuggestedChip,
    label: string,
    onSelect: () => void
  ) => (
    <button
      key={chip.id}
      type="button"
      onClick={onSelect}
      className={chipBase}
    >
      <span>{label}</span>
      {onChipRemove && (
        <span
          role="button"
          aria-label="Discard suggestion"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onChipRemove(chip);
          }}
          className={cn(
            'ml-0 w-0 overflow-hidden opacity-0',
            'group-hover:ml-[5px] group-hover:w-[10px] group-hover:opacity-60',
            'hover:!opacity-100',
            'transition-all duration-150 flex items-center justify-center flex-shrink-0'
          )}
        >
          <X className="h-[9px] w-[9px]" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );

  return (
    <div className={cn('flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5', className)}>
      {/* Filla coral indicator */}
      <FillaIcon size={11} className="text-[#EB6834] shrink-0 flex-none" />

      {/* Resolved / fact suggestion chips */}
      {factChips.map((chip) =>
        renderChip(
          chip,
          chip.label.toUpperCase(),
          () => onFactChipPress ? onFactChipPress(chip) : onChipSelect(chip)
        )
      )}

      {/* Verb / action chips (Invite X, Add Y) */}
      {verbChips.map((chip) =>
        renderChip(chip, verbLabel(chip), () => onChipSelect(chip))
      )}
    </div>
  );
};

export default AISuggestionChips;
