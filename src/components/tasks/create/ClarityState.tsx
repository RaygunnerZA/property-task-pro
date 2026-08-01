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
        'w-full px-4 py-3 rounded-card',
        'flex items-start gap-2',
        isBlocking
          ? 'bg-warning/30 border border-warning'
          : 'bg-warning/30 border border-warning',
        className
      )}
    >
      <FillaIcon size={14} className="text-warning-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm text-amber-900/80 leading-relaxed">
          {message}
        </p>
      </div>
    </div>
  );
};

