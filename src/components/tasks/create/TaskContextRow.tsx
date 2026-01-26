/**
 * TaskContextRow - Displays resolved task context (metadata chips only)
 * 
 * CHIP ROLE DISTINCTION (RESTORED):
 * - Metadata chips: Resolved entities (space, theme, person, team, etc.) that persist to task metadata
 * - Action chips: Unresolved chips requiring user action (e.g., "INVITE JAMES", "ADD STOVE")
 *   - Action chips must NOT appear here - they belong in the verb chips clarity block
 *   - Action chips must NOT persist to task submission
 * 
 * Design Contract:
 * - Shows resolved context chips only (what Filla already knows)
 * - Chips are removable via × on hover
 * - No animations
 * - No navigation behavior
 * - Section icons provide navigation only
 */

import React from 'react';
import { User, MapPin, Calendar, Box, AlertTriangle, Tag, Users } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Chip } from "@/components/chips/Chip";
import { PerforationLine } from "./PerforationLine";
import type { SuggestedChip, ChipType } from '@/types/chip-suggestions';
import fillaAISrc from "@/assets/filla-ai.svg";

const sections = [
  { id: "who", icon: User, label: "Who is responsible", tooltip: "Person / Assignee" },
  { id: "where", icon: MapPin, label: "Where", tooltip: "Property → Space" },
  { id: "when", icon: Calendar, label: "When", tooltip: "Date / Time" },
  { id: "what", icon: Box, label: "What", tooltip: "Asset" },
  { id: "priority", icon: AlertTriangle, label: "Priority", tooltip: "Urgency / Risk" },
  { id: "category", icon: Tag, label: "Category / Type", tooltip: "Maintenance, Inspection, Admin, etc." },
] as const;

// Map chip types to section icons
const chipTypeToIcon: Record<string, React.ElementType> = {
  space: MapPin,
  person: User,
  team: Users,
  date: Calendar,
  category: Tag,
  asset: Box,
  priority: AlertTriangle,
};

interface TaskContextRowProps {
  factChips: SuggestedChip[]; // Metadata chips only (resolved or non-blocking)
  onChipRemove?: (chip: SuggestedChip) => void;
  activeSection: string | null;
  onSectionClick: (section: string | null) => void;
  unresolvedSections?: string[];
}

export function TaskContextRow({
  factChips,
  onChipRemove,
  activeSection,
  onSectionClick,
  unresolvedSections = [],
}: TaskContextRowProps) {
  // ROLE FILTER: Ensure only metadata chips are displayed
  // INVITE BEHAVIORAL CONTRACT: Person chips with blockingRequired && !resolvedEntityId are Invite actions
  // Invite chips are NOT normal chips - they are gated actions that cannot be treated as passive metadata
  // Action chips (blockingRequired && !resolvedEntityId) should never reach this component
  // They belong in the verb chips clarity block, not as task metadata
  // INVITE BEHAVIORAL CONTRACT: Invite intent cannot persist as task metadata
  // Invite chips must be resolved to a specific person/team or removed - they cannot appear here
  const metadataChips = factChips.filter(chip => 
    // Metadata chips are: resolved (have resolvedEntityId) OR don't require blocking
    // INVITE BEHAVIORAL CONTRACT: Person chips without resolvedEntityId are Invite actions and must be excluded
    // Invite chips are action intent, not passive metadata - they must be gated out
    chip.resolvedEntityId || !chip.blockingRequired
  );
  
  // Group metadata chips by type for organized display
  const factChipsByType = metadataChips.reduce((acc, chip) => {
    if (!acc[chip.type]) acc[chip.type] = [];
    acc[chip.type].push(chip);
    return acc;
  }, {} as Record<string, SuggestedChip[]>);

  // Sort types by priority order
  const typeOrder = ['space', 'person', 'team', 'date', 'category', 'asset'];
  const sortedFactTypes = Object.keys(factChipsByType).sort(
    (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
  );

  const hasChips = metadataChips.length > 0;

  return (
    <div className="space-y-4">
      {/* Context Chips Row - Only show if there are chips */}
      {hasChips && (
        <div className="space-y-2">
          {/* FILLA SET Header */}
          <label className="text-[12px] font-mono uppercase tracking-wider text-primary flex items-center gap-1.5 py-1">
            <img 
              src={fillaAISrc} 
              alt="Filla AI" 
              className="inline-block"
              style={{ width: 12, height: 12 }}
            />
            FILLA SET
          </label>
          
          {/* Fact chips (resolved context) */}
          <div className="flex flex-wrap gap-2">
            {sortedFactTypes.map((type) => (
              <div key={type} className="flex flex-wrap gap-1.5">
                {factChipsByType[type].map((chip) => {
                  // Determine if chip is AI-pre-filled: has resolvedEntityId and came from AI
                  const isAIPreFilled = chip.resolvedEntityId && (chip.source === 'rule' || chip.source === 'ai' || chip.source === 'fallback');
                  
                  // Get icon for this chip type
                  const IconComponent = chipTypeToIcon[chip.type];
                  const icon = IconComponent ? <IconComponent className="h-3 w-3" /> : undefined;
                  
                  return (
                    <Chip
                      key={chip.id}
                      role="fact"
                      label={chip.label.toUpperCase()}
                      icon={icon}
                      onRemove={onChipRemove ? () => onChipRemove(chip) : undefined}
                      aiPreFilled={isAIPreFilled}
                      animate={false}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Perforation Line - Separates context from navigation */}
      {hasChips && (
        <div className="overflow-hidden h-[29px] mt-[3px]">
          <PerforationLine />
        </div>
      )}

      {/* Section Navigation Strip - Navigation only */}
      <div className="flex items-center gap-2 flex-wrap mt-2 mb-2 pb-[11px]">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          const hasUnresolved = unresolvedSections.includes(section.id);

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionClick(isActive ? null : section.id)}
              className={cn(
                "relative h-[35px] w-[35px] rounded-[5px] flex items-center justify-center",
                "transition-all duration-150",
                isActive
                  ? "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] bg-card"
                  : "shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] bg-background hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] hover:bg-card"
              )}
            >
              <Icon className={cn(
                "h-5 w-5",
                isActive ? "text-primary" : "text-muted-foreground"
              )} />
            
              {/* Warning marker for unresolved sections */}
              {hasUnresolved && !isActive && (
                <div className="absolute -top-1 -right-1">
                  <div className="h-2 w-2 rounded-full bg-amber-500 border border-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
