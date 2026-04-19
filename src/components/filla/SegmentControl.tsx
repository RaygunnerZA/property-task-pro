import React from 'react';
import { colors, shadows } from './tokens';
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
 * Swiss design with inset background and raised active state
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
      className={cn('rounded-lg flex items-center gap-0.5', compact ? 'p-1' : 'p-1.5 gap-1', className)}
      style={{ 
        backgroundColor: colors.background,
        boxShadow: shadows.inset 
      }}
    >
      {options.map(opt => {
        const isActive = selectedId === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(
              'flex-1 font-semibold rounded-md transition-all duration-200 active:scale-95',
              compact ? 'px-1.5 py-1.5 text-[11px] leading-tight min-w-0' : 'px-4 py-2 text-sm',
            )}
            style={{
              color: isActive ? colors.ink : colors.textMuted,
              backgroundColor: isActive ? colors.surface : 'transparent',
              boxShadow: isActive ? shadows.outset : 'none',
              transform: isActive ? 'scale(1.02)' : 'scale(1)'
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
