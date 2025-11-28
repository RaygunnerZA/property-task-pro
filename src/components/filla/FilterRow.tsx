import React from 'react';
import { cn } from '@/lib/utils';

export interface FilterRowProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * FilterRow - Horizontal scrolling container for filter chips
 * Includes gradient mask for scroll indication
 */
export const FilterRow: React.FC<FilterRowProps> = ({ children, className = '' }) => (
  <div className={cn(
    'flex items-center gap-2 overflow-x-auto no-scrollbar mask-gradient-right px-1 pb-1',
    className
  )}>
    {children}
  </div>
);
