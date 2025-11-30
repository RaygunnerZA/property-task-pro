import React from 'react';
import { colors, shadows } from './DesignSystem';
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
}

/**
 * SegmentControl - Neomorphic tab-like filter control
 * Swiss design with inset background and raised active state
 */
export const SegmentControl: React.FC<SegmentControlProps> = ({ 
  options, 
  selectedId, 
  onChange, 
  className = '' 
}) => {
  return (
    <div 
      className={cn('p-1.5 rounded-lg flex items-center gap-1', className)}
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
              'flex-1 px-4 py-2 text-sm font-semibold rounded-md',
              'transition-all duration-200',
              'active:scale-95'
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
