/**
 * TaskSection - Unified section component for Create Task
 * 
 * System-level section model:
 * - Icon stands outside to the left
 * - Row shows fact chips OR verb chips (not both)
 * - No section titles, dash, or chevron
 * - Expanded sections are the only place actions occur
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FactChip {
  id: string;
  label: string;
  onRemove?: () => void;
  isSuggested?: boolean;
  tooltip?: string;
}

interface VerbChip {
  id: string;
  label: string;
  onSelect?: () => void;
  chip?: any; // Store original chip for lazy handler creation
}

interface TaskSectionProps {
  id: string;
  icon?: React.ReactNode;
  factChips?: FactChip[];
  verbChips?: VerbChip[];
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode; // Expanded content (actions only)
  className?: string;
}

export function TaskSection({
  id,
  icon,
  factChips = [],
  verbChips = [],
  isExpanded,
  onToggle,
  children,
  className
}: TaskSectionProps) {
  const hasFacts = factChips.length > 0;
  const hasVerbs = verbChips.length > 0;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center gap-2">
        {/* Icon - Outside to the left, not in the neumorphic button */}
        {icon && (
          <div className="h-4 w-4 flex items-center justify-center shrink-0 text-muted-foreground">
            {icon}
          </div>
        )}

        {/* Collapsed Row - Shows fact chips OR verb chips */}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex-1 h-8 flex items-center gap-1.5 px-2 rounded-[5px]',
            'transition-all duration-150',
            'bg-background',
            'hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] hover:bg-card'
          )}
        >
          {/* Show fact chips if available, otherwise show verb chips */}
          {hasFacts ? (
            <TooltipProvider delayDuration={300}>
              <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                {factChips.map((chip, index) => {
                  const chipElement = (
                    <span 
                      key={chip.id}
                      className={cn(
                        "text-sm truncate",
                        chip.isSuggested 
                          ? "text-muted-foreground italic" 
                          : "text-foreground/80"
                      )}
                    >
                      {chip.label}
                    </span>
                  );
                  
                  // Wrap in tooltip if suggested and has tooltip text
                  if (chip.isSuggested && chip.tooltip) {
                    return (
                      <React.Fragment key={chip.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {chipElement}
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{chip.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                        {index < factChips.length - 1 && (
                          <span className="text-xs text-muted-foreground shrink-0">·</span>
                        )}
                      </React.Fragment>
                    );
                  }
                  
                  return (
                    <React.Fragment key={chip.id}>
                      {chipElement}
                      {index < factChips.length - 1 && (
                        <span className="text-xs text-muted-foreground shrink-0">·</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </TooltipProvider>
        ) : hasVerbs ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
            {verbChips.map((chip, index) => (
              <React.Fragment key={chip.id}>
                <span 
                  className="text-sm text-foreground/80 truncate cursor-pointer hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (chip.onSelect) {
                      chip.onSelect();
                    } else if (chip.chip) {
                      // Lazy handler creation - will be set by parent
                      console.warn('Verb chip handler not set');
                    }
                  }}
                >
                  {chip.label}
                </span>
                {index < verbChips.length - 1 && (
                  <span className="text-xs text-muted-foreground shrink-0">·</span>
                )}
              </React.Fragment>
            ))}
          </div>
        ) : null}
        </button>
      </div>

      {/* Expanded Content - Actions only */}
      {isExpanded && (
        <div className="mt-2 ml-6">
          {children}
        </div>
      )}
    </div>
  );
}
