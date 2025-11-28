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
      'bg-transparent p-1.5 rounded-lg flex items-center relative',
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
              'relative z-10 flex-1 px-4 py-2 text-xs font-bold transition-all duration-200',
              'rounded-[10px] text-center',
              isActive 
                ? 'text-ink bg-card shadow-e1 scale-[1.02]'
                : 'text-muted-foreground hover:text-ink'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
