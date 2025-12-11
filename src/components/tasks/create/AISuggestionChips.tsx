/**
 * AI Suggestion Chips Component
 * Displays intelligent chip suggestions with fade-in animations
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { AIChip } from '@/components/filla/AIChip';
import { SuggestedChip, GhostGroup } from '@/types/chip-suggestions';
import { 
  MapPin, 
  User, 
  Users, 
  AlertTriangle, 
  Folder, 
  Shield, 
  Calendar,
  Sparkles
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
        <Sparkles className="w-4 h-4 text-accent animate-pulse" />
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
      {/* AI indicator */}
      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles className="w-3 h-3 text-accent" />
        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
          Suggestions
        </span>
      </div>

      {/* Chips by category */}
      <div className="flex flex-wrap gap-2">
        {sortedTypes.map((type) => (
          <div key={type} className="flex flex-wrap gap-1.5">
            {chipsByType[type].map((chip, index) => {
              const Icon = chipTypeIcons[chip.type] || Sparkles;
              const isSelected = selectedChipIds.includes(chip.id);
              
              return (
                <button
                  key={chip.id}
                  onClick={() => onChipSelect(chip)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1.5',
                    'text-xs font-medium rounded-[5px] transition-all duration-150',
                    'animate-in fade-in slide-in-from-bottom-1',
                    isSelected
                      ? 'bg-accent text-white shadow-e2'
                      : 'bg-card text-ink shadow-e1 hover:shadow-e2 hover:bg-card/80'
                  )}
                  style={{
                    animationDelay: `${index * 20}ms`,
                    animationDuration: '120ms'
                  }}
                >
                  <Icon className="w-3 h-3" />
                  <span className="font-mono">{chip.label}</span>
                  {chip.score >= 0.8 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Ghost groups */}
      {ghostGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
          <span className="text-[10px] text-muted-foreground font-mono mr-1 self-center">
            Quick groups:
          </span>
          {ghostGroups.map((group, index) => (
            <button
              key={group.id}
              onClick={() => onGhostGroupSelect(group)}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5',
                'text-xs font-medium rounded-[5px]',
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
