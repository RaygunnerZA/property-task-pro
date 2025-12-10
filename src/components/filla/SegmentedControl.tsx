import React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedControlOption {
  id: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  selectedId: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * SegmentedControl - Tab-like filter control with engraved background
 */
export const SegmentedControl: React.FC<SegmentedControlProps> = ({ 
  options, 
  selectedId, 
  onChange, 
  className = '' 
}) => {
  return (
    <div className={cn(
      'bg-transparent p-1.5 rounded-[5px] flex items-center relative',
      'shadow-engraved border border-concrete',
      className
    )}>
      {options.map(opt => {
        const isActive = selectedId === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(
              'relative z-10 flex-1 px-4 py-2 text-xs font-bold transition-all duration-150',
              'rounded-[5px] text-center',
              isActive 
                ? 'neo-surface-active text-ink bg-transparent'
                : 'neo-surface text-muted-foreground hover:text-ink bg-transparent'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
