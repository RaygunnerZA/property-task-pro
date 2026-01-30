/**
 * AI Suggestion Chips Component
 * Displays intelligent chip suggestions with fade-in animations
 * 
 * Design Contract:
 * - Suggestions never auto-apply
 * - Suggestions never disappear when applied
 * - Suggestions never look "decided" until validated
 * - Background: same as modal background (no card)
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { SuggestedChip, GhostGroup, ChipState, ChipType } from '@/types/chip-suggestions';
import { FillaIcon } from '@/components/filla/FillaIcon';
import { Chip } from '@/components/chips/Chip';
import { 
  MapPin, 
  User, 
  Users, 
  AlertTriangle, 
  Folder, 
  Shield, 
  Calendar,
  Check
} from 'lucide-react';

interface AISuggestionChipsProps {
  chips: SuggestedChip[];
  ghostGroups: GhostGroup[];
  onChipSelect: (chip: SuggestedChip) => void;
  onGhostGroupSelect: (group: GhostGroup) => void;
  onChipRemove?: (chip: SuggestedChip) => void;
  selectedChipIds?: string[];
  loading?: boolean;
  className?: string;
}

/**
 * Get chip state based on selection and resolution
 */
function getChipState(chip: SuggestedChip, isSelected: boolean): ChipState {
  if (chip.state) return chip.state;
  if (chip.resolvedEntityId) return 'resolved';
  if (isSelected) return 'applied';
  if (chip.blockingRequired && !chip.resolvedEntityId) return 'blocked';
  return 'suggested';
}

/**
 * Generate verb label for unresolved/ambiguous entities
 * Examples: "INVITE FRANK", "ADD GARDEN TO SPACES", "CHOOSE ALEX"
 */
function generateVerbLabel(chip: SuggestedChip): string {
  const value = chip.value || chip.label;
  
  switch (chip.type) {
    case 'person':
      return `INVITE ${value.toUpperCase()}`;
    case 'team':
      return `CHOOSE ${value.toUpperCase()}`;
    case 'space':
      return `ADD ${value.toUpperCase()} TO SPACES`;
    case 'asset':
      return `ADD ${value.toUpperCase()} TO ASSETS`;
    case 'category':
      return `CHOOSE ${value.toUpperCase()}`;
    case 'date':
      return `SET ${value.toUpperCase()}`;
    default:
      return `CHOOSE ${value.toUpperCase()}`;
  }
}

const chipTypeIcons: Record<string, React.ElementType> = {
  space: MapPin,
  person: User,
  team: Users,
  priority: AlertTriangle,
  group: Folder,
  compliance: Shield,
  date: Calendar
};

const chipTypeLabels: Record<string, string> = {
  space: 'Space',
  person: 'Assign',
  team: 'Team',
  priority: 'Priority',
  group: 'Group',
  compliance: 'Compliance',
  date: 'When'
};

export const AISuggestionChips: React.FC<AISuggestionChipsProps> = ({
  chips,
  ghostGroups,
  onChipSelect,
  onGhostGroupSelect,
  onChipRemove,
  selectedChipIds = [],
  loading = false,
  className
}) => {
  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 py-2', className)}>
        <FillaIcon size={16} className="text-accent animate-pulse" />
        <span className="text-xs text-muted-foreground font-mono">
          Analyzing...
        </span>
      </div>
    );
  }

  if (chips.length === 0 && ghostGroups.length === 0) {
    return null;
  }

  // Filter chips to only types that should render as fact/verb chips:
  // Who (person, team), Where (space), Assets (asset), Categories (category), Dates (date), Recurrence
  // Recurrence never blocks entity resolution - it's always a fact chip
  const factChipTypes: ChipType[] = ['person', 'team', 'space', 'asset', 'category', 'date', 'recurrence'];
  const relevantChips = chips.filter(chip => factChipTypes.includes(chip.type));

  // Separate resolved chips (fact) from unresolved/ambiguous chips (verb)
  // A chip is unresolved (verb) if: blockingRequired && !resolvedEntityId
  // Recurrence chips never have blockingRequired, so they always render as fact chips
  const factChips = relevantChips.filter(chip => 
    chip.resolvedEntityId || !chip.blockingRequired
  );
  const verbChips = relevantChips.filter(chip => 
    chip.blockingRequired && !chip.resolvedEntityId
  );

  // Group fact chips by type for organized display
  const factChipsByType = factChips.reduce((acc, chip) => {
    if (!acc[chip.type]) acc[chip.type] = [];
    acc[chip.type].push(chip);
    return acc;
  }, {} as Record<string, SuggestedChip[]>);

  // Sort types by priority order
  const typeOrder = ['space', 'person', 'team', 'date', 'category', 'asset'];
  const sortedFactTypes = Object.keys(factChipsByType).sort(
    (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
  );

  return (
    <div className={cn('space-y-2', className)}>
      {/* AI indicator - one Filla glyph at row level only */}
      <div className="flex items-center gap-1.5 mb-1">
        <FillaIcon size={12} className="text-muted-foreground/70" />
        <span className="text-[10px] text-muted-foreground/70 font-mono uppercase tracking-wider font-normal">
          Filla picked up:
        </span>
      </div>

      {/* Fact chips (resolved entities) - separate row */}
      {factChips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sortedFactTypes.map((type) => (
            <div key={type} className="flex flex-wrap gap-1.5">
              {factChipsByType[type].map((chip, index) => {
                // Determine if chip is AI-pre-filled: has resolvedEntityId and came from AI (rule/ai/fallback source)
                // In AISuggestionChips, all chips are from AI suggestions, so if they have resolvedEntityId, they're AI-pre-filled
                const isAIPreFilled = chip.resolvedEntityId && (chip.source === 'rule' || chip.source === 'ai' || chip.source === 'fallback');
                
                // Render as fact chip (AI-pre-filled have subtle styling to reduce visual dominance)
                return (
                  <Chip
                    key={chip.id}
                    role="fact"
                    label={chip.label.toUpperCase()}
                    onRemove={onChipRemove ? () => onChipRemove(chip) : undefined}
                    aiPreFilled={isAIPreFilled}
                    animate={true}
                    className={cn(
                      'animate-in fade-in slide-in-from-bottom-1'
                    )}
                    style={{
                      animationDelay: `${index * 20}ms`,
                      animationDuration: '120ms'
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Verb chips (unresolved/ambiguous entities) - separate row */}
      {verbChips.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {verbChips.map((chip, index) => {
            // Render as verb chip (white bg, dashed border, orange text, no shadow, no removal)
            const verbLabel = generateVerbLabel(chip);
            return (
              <Chip
                key={chip.id}
                role="verb"
                label={verbLabel}
                onSelect={() => onChipSelect(chip)}
                animate={true}
                className={cn(
                  'animate-in fade-in slide-in-from-bottom-1'
                )}
                style={{
                  animationDelay: `${(factChips.length + index) * 20}ms`,
                  animationDuration: '120ms'
                }}
              />
            );
          })}
        </div>
      )}

      {/* Ghost groups */}
      {ghostGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/20">
          <span className="text-[10px] text-muted-foreground font-mono mr-1 self-center">
            Quick groups:
          </span>
          {ghostGroups.map((group, index) => (
            <button
              key={group.id}
              onClick={() => onGhostGroupSelect(group)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5',
                'text-[13px] font-medium rounded-[8px]',
                'bg-transparent border border-dashed border-accent/40',
                'text-accent/70 hover:bg-accent/5 hover:border-accent',
                'transition-all duration-150',
                'animate-in fade-in slide-in-from-bottom-1'
              )}
              style={{
                animationDelay: `${(chips.length + index) * 20}ms`,
                animationDuration: '120ms'
              }}
            >
              <Folder className="w-3 h-3" />
              <span className="font-mono">{group.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AISuggestionChips;
