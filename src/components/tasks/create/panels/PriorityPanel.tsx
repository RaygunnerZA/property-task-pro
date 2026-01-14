/**
 * PriorityPanel - Task Context Resolver for priority
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ContextResolver } from '../ContextResolver';
import { Chip } from '@/components/chips/Chip';
import type { TaskPriority } from '@/types/database';

interface PriorityPanelProps {
  priority: TaskPriority;
  onPriorityChange: (priority: TaskPriority) => void;
}

const priorities: Array<{ value: TaskPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function PriorityPanel({
  priority,
  onPriorityChange
}: PriorityPanelProps) {
  return (
    <ContextResolver
      title=""
      helperText=""
    >
        <div className="flex items-center gap-2 w-full min-w-0">
          {/* PRIORITY chip - Fixed on left */}
          <div className="inline-flex items-center gap-1.5 pl-[9px] pr-1.5 py-1.5 rounded-[8px] h-[29px] bg-background text-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] shrink-0 font-mono">
            <span className="text-[12px] uppercase leading-[16px]">PRIORITY</span>
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
        
        {/* Scrollable middle section with priority chips */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden min-w-0 no-scrollbar">
          <div className="flex items-center gap-2 h-[40px]">
            {priorities.map(p => (
              <Chip
                key={p.value}
                role="filter"
                label={p.label.toUpperCase()}
                selected={priority === p.value}
                onSelect={() => onPriorityChange(p.value)}
                className="shrink-0"
              />
            ))}
          </div>
        </div>
      </div>
    </ContextResolver>
  );
}

