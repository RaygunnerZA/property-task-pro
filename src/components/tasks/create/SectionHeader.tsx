/**
 * SectionHeader - Phase 4: Context Clarity
 * 
 * Design Contract:
 * - Shows section icon + summary of resolved facts
 * - Hover reveals primary action (left-aligned)
 * - No suggestion chips in header
 * - Truncates gracefully after 2 items (e.g., "Frank · Fix Crew · +1")
 * - Calm, minimal, informative
 */

import React, { useState, useMemo } from 'react';
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type SectionType = 'who' | 'where' | 'asset' | 'tags' | 'when' | 'priority' | 'compliance';

interface ResolvedItem {
  id: string;
  label: string;
  /** Tooltip explaining why this was resolved (Phase 4 requirement) */
  reason?: string;
}

interface SectionHeaderProps {
  type: SectionType;
  icon: React.ElementType;
  resolvedItems: ResolvedItem[];
  suggestedItems?: ResolvedItem[]; // Not shown in header, but tracked
  isExpanded?: boolean;
  onClick?: () => void;
  /** Custom action text (overrides default) */
  actionText?: string;
  className?: string;
}

// Default action text per section type
const DEFAULT_ACTIONS: Record<SectionType, string> = {
  who: 'Add person or team',
  where: 'Add property or space',
  asset: 'Add asset',
  tags: 'Add tags',
  when: 'Set date or repeat',
  priority: 'Set priority',
  compliance: 'Set compliance',
};

// Section display names
const SECTION_NAMES: Record<SectionType, string> = {
  who: 'Who',
  where: 'Where',
  asset: 'Asset',
  tags: 'Tags',
  when: 'When',
  priority: 'Priority',
  compliance: 'Compliance',
};

/**
 * Build summary text from resolved items.
 * Format: "Item1 · Item2 · +N" (max 2 visible, then overflow count)
 */
function buildSummary(items: ResolvedItem[], maxVisible = 2): string {
  if (items.length === 0) return '';
  
  const visible = items.slice(0, maxVisible);
  const overflow = items.length - maxVisible;
  
  let summary = visible.map(item => item.label).join(' · ');
  
  if (overflow > 0) {
    summary += ` · +${overflow}`;
  }
  
  return summary;
}

export function SectionHeader({
  type,
  icon: Icon,
  resolvedItems,
  suggestedItems = [],
  isExpanded = false,
  onClick,
  actionText,
  className,
}: SectionHeaderProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  const summary = useMemo(() => buildSummary(resolvedItems), [resolvedItems]);
  const action = actionText || DEFAULT_ACTIONS[type];
  const sectionName = SECTION_NAMES[type];
  
  const hasResolved = resolvedItems.length > 0;
  const hasSuggested = suggestedItems.length > 0;
  
  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 px-1 rounded-md cursor-pointer",
        "transition-all duration-150",
        isHovered && !isExpanded && "bg-muted/30",
        isExpanded && "bg-muted/50",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Icon */}
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      
      {/* Content area */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {/* Show action on hover when no items, otherwise show summary */}
        {isHovered && !hasResolved && !isExpanded ? (
          <span className="text-sm text-muted-foreground/70 truncate">
            {action}
          </span>
        ) : hasResolved ? (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm font-medium text-foreground truncate">
                  {summary}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  {resolvedItems.map(item => (
                    <div key={item.id} className="text-xs">
                      <span className="font-medium">{item.label}</span>
                      {item.reason && (
                        <span className="text-muted-foreground ml-1">— {item.reason}</span>
                      )}
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-sm text-muted-foreground/50 truncate">
            {sectionName}
          </span>
        )}
        
        {/* Hover action when items exist */}
        {isHovered && hasResolved && !isExpanded && (
          <span className="text-xs text-muted-foreground/60 flex-shrink-0">
            {action}
          </span>
        )}
      </div>
      
      {/* Suggestion indicator (subtle, not chips) */}
      {hasSuggested && !hasResolved && !isHovered && (
        <span className="text-xs text-muted-foreground/40 flex-shrink-0">
          {suggestedItems.length} suggested
        </span>
      )}
    </div>
  );
}

export type { ResolvedItem };
