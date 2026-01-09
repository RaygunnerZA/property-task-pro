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
import { SuggestedChip, GhostGroup, ChipState } from '@/types/chip-suggestions';
import { FillaIcon } from '@/components/filla/FillaIcon';
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

  // Group chips by type for organized display
  const chipsByType = chips.reduce((acc, chip) => {
    if (!acc[chip.type]) acc[chip.type] = [];
    acc[chip.type].push(chip);
    return acc;
  }, {} as Record<string, SuggestedChip[]>);

  // Sort types by priority order
  const typeOrder = ['priority', 'space', 'person', 'team', 'date', 'group', 'compliance'];
  const sortedTypes = Object.keys(chipsByType).sort(
    (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
  );

  return (
    <div className={cn('space-y-2', className)}>
      {/* AI indicator - using Filla.svg */}
      <div className="flex items-center gap-1.5 mb-1">
        <FillaIcon size={12} className="text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
          Suggestions
        </span>
      </div>

      {/* Chips by category */}
      <div className="flex flex-wrap gap-2">
        {sortedTypes.map((type) => (
          <div key={type} className="flex flex-wrap gap-1.5">
            {chipsByType[type].map((chip, index) => {
              const Icon = chipTypeIcons[chip.type] || MapPin;
              const isSelected = selectedChipIds.includes(chip.id);
              const state = getChipState(chip, isSelected);
              
              // Chip styling based on state (Design Constraints section 1)
              const chipStyles = {
                suggested: 'border-dashed border-muted-foreground/30 bg-transparent text-ink',
                applied: 'bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]',
                resolved: 'bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]',
                blocked: 'border border-amber-500/50 bg-transparent text-amber-700'
              };
              
              return (
                <button
                  key={chip.id}
                  onClick={() => onChipSelect(chip)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1.5',
                    'text-[13px] font-medium rounded-[5px] transition-all duration-150',
                    'animate-in fade-in slide-in-from-bottom-1',
                    chipStyles[state]
                  )}
                  style={{
                    animationDelay: `${index * 20}ms`,
                    animationDuration: '120ms'
                  }}
                >
                  <Icon className="w-3 h-3" />
                  <span className="font-mono">{chip.label}</span>
                  {state === 'resolved' && (
                    <Check className="w-3 h-3 text-muted-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

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
                'text-[13px] font-medium rounded-[5px]',
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
