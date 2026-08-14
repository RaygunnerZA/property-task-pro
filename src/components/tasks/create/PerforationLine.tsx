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
      className={cn('perforation-section -ml-4 -mr-4 px-1 my-4', className)}
      aria-hidden="true"
    />
  );
};

