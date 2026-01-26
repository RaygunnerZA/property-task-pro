/**
 * BlockingClarity - Phase 4: Single Blocking Surface
 * 
 * Design Contract:
 * - Appears ONLY at the bottom of the form
 * - Only shows when:
 *   1. Required entity is missing (e.g., property in All Properties view)
 *   2. Resolver cannot disambiguate (multiple equal candidates)
 * - One sentence, one verb, one action
 * - No chips except verb chips
 * - Calm, clear, actionable
 */

import React from 'react';
import { cn } from "@/lib/utils";
import { Chip } from "@/components/chips/Chip";

export type BlockingReason = 
  | 'missing_property'
  | 'missing_space'
  | 'missing_assignee'
  | 'ambiguous_property'
  | 'ambiguous_space'
  | 'ambiguous_person';

interface BlockingClarityProps {
  reason: BlockingReason;
  /** Entity options for disambiguation (if ambiguous) */
  options?: Array<{ id: string; label: string }>;
  /** Callback when user resolves the blocking state */
  onResolve?: (entityId: string) => void;
  /** Callback to open relevant section for resolution */
  onOpenSection?: () => void;
  className?: string;
}

// Blocking messages - one sentence, one verb
const BLOCKING_MESSAGES: Record<BlockingReason, { message: string; action: string }> = {
  missing_property: {
    message: 'Choose which property this task applies to.',
    action: 'Choose property',
  },
  missing_space: {
    message: 'Choose which space this task applies to.',
    action: 'Choose space',
  },
  missing_assignee: {
    message: 'Choose who is responsible for this task.',
    action: 'Choose person',
  },
  ambiguous_property: {
    message: 'Multiple properties match. Choose one.',
    action: 'Choose property',
  },
  ambiguous_space: {
    message: 'Multiple spaces match. Choose one.',
    action: 'Choose space',
  },
  ambiguous_person: {
    message: 'Multiple people match. Choose one.',
    action: 'Choose person',
  },
};

export function BlockingClarity({
  reason,
  options = [],
  onResolve,
  onOpenSection,
  className,
}: BlockingClarityProps) {
  const { message, action } = BLOCKING_MESSAGES[reason];
  const hasOptions = options.length > 0;
  
  return (
    <div
      className={cn(
        "p-3 rounded-md bg-amber-50/50 border border-amber-200/50",
        "flex flex-col gap-2",
        className
      )}
    >
      {/* Message */}
      <p className="text-sm text-amber-800">
        {message}
      </p>
      
      {/* Options (if disambiguation needed) */}
      {hasOptions ? (
        <div className="flex flex-wrap gap-2">
          {options.map(option => (
            <Chip
              key={option.id}
              role="verb"
              label={option.label}
              onSelect={() => onResolve?.(option.id)}
            />
          ))}
        </div>
      ) : (
        /* Single action button */
        <Chip
          role="verb"
          label={action}
          onSelect={onOpenSection}
        />
      )}
    </div>
  );
}

/**
 * Hook to determine if blocking is needed and why.
 * 
 * @param propertyId - Selected property ID
 * @param isAllPropertiesView - Whether user is in "All Properties" view
 * @param unresolvedChips - Chips that couldn't be resolved
 * @returns Blocking reason or null if no blocking needed
 */
export function useBlockingReason(
  propertyId: string | undefined,
  isAllPropertiesView: boolean,
  unresolvedChips: Array<{ type: string; label: string; options?: Array<{ id: string; label: string }> }>
): { reason: BlockingReason; options?: Array<{ id: string; label: string }> } | null {
  // Property required in All Properties view
  if (isAllPropertiesView && !propertyId) {
    return { reason: 'missing_property' };
  }
  
  // Check for ambiguous resolutions
  for (const chip of unresolvedChips) {
    if (chip.options && chip.options.length > 1) {
      switch (chip.type) {
        case 'property':
          return { reason: 'ambiguous_property', options: chip.options };
        case 'space':
          return { reason: 'ambiguous_space', options: chip.options };
        case 'person':
          return { reason: 'ambiguous_person', options: chip.options };
      }
    }
  }
  
  return null;
}
