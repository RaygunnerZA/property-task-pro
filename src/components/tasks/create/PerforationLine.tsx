/**
 * PerforationLine - Semantic threshold marker
 * 
 * Design Constraints:
 * - "Above this line: interpretation. Below this line: commitment."
 * - Full-width
 * - Dotted or perforated appearance
 * - Subtle contrast (must not dominate)
 * - Appears once, directly under the AI Suggestion Panel
 * - Never reused elsewhere
 * - This is a threshold marker, not layout chrome
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface PerforationLineProps {
  className?: string;
}

export const PerforationLine: React.FC<PerforationLineProps> = ({ className }) => {
  return (
    <div 
      className={cn('-ml-4 -mr-4 pt-px pb-0 px-1 my-4', className)}
      style={{
        height: '2px',
        backgroundImage: 'repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 6px)',
        backgroundSize: '6px 2px',
        backgroundRepeat: 'repeat-x',
        boxShadow: '1px 1px 0px rgba(255, 255, 255, 1), -1px -1px 1px rgba(0, 0, 0, 0.075)',
      }}
      aria-hidden="true"
    />
  );
};

