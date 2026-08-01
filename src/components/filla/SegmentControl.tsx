import React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentOption {
  id: string;
  label: string;
}

interface SegmentControlProps {
  options: SegmentOption[];
  selectedId: string;
  onChange: (id: string) => void;
  className?: string;
  /** Tighter padding and type for dense toolbars (e.g. Issues mode row). */
  compact?: boolean;
}

/**
 * SegmentControl - Neomorphic tab-like filter control
 * Debossed track with a raised paper active segment.
 */
export const SegmentControl: React.FC<SegmentControlProps> = ({ 
  options, 
  selectedId, 
  onChange, 
  className = '',
  compact = false,
}) => {
  return (
    <div 
      className={cn(
        'rounded-lg flex items-center gap-0.5 bg-background shadow-inset',
        compact ? 'p-1' : 'p-1.5 gap-1',
        className,
      )}
      role="group"
    >
      {options.map(opt => {
        const isActive = selectedId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={isActive}
            className={cn(
              'flex-1 font-semibold rounded-md transition-[transform,box-shadow,background-color,color] duration-200 active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              compact ? 'px-1.5 py-1.5 text-[11px] leading-tight min-w-0' : 'px-4 py-2 text-sm',
              isActive
                ? 'bg-card text-foreground shadow-e1 scale-[1.02]'
                : 'bg-transparent text-muted-foreground shadow-none scale-100',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
