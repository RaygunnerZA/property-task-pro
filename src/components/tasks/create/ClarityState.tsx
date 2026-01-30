/**
 * ClarityState - "Resolve before creating" component
 * 
 * Design Constraints:
 * - Not an error state
 * - Calm, neutral, explanatory
 * - Never alarming
 * - Full width
 * - Lives directly above primary CTA
 * - Neutral amber (never red)
 * - Uses Filla.svg
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { FillaIcon } from '@/components/filla/FillaIcon';

export type ClaritySeverity = 'blocking' | 'warning';

interface ClarityStateProps {
  severity: ClaritySeverity;
  message: string;
  className?: string;
}

export const ClarityState: React.FC<ClarityStateProps> = ({
  severity,
  message,
  className
}) => {
  const isBlocking = severity === 'blocking';
  
  return (
    <div
      className={cn(
        'w-full px-4 py-3 rounded-[8px]',
        'flex items-start gap-2',
        isBlocking
          ? 'bg-amber-50/50 border border-amber-200/50'
          : 'bg-amber-50/30 border border-amber-200/30',
        className
      )}
    >
      <FillaIcon size={14} className="text-amber-700 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-amber-900/80 leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
};

