/**
 * FillaIcon - System-initiated guidance icon
 * Only precedes system-generated guidance text
 * Never appears inside chips, next to user text, or as decoration
 */

import React from 'react';
import { cn } from '@/lib/utils';
import fillaSvg from '@/assets/filla.svg';

interface FillaIconProps {
  className?: string;
  size?: number;
}

export const FillaIcon: React.FC<FillaIconProps> = ({ 
  className,
  size = 16 
}) => {
  return (
    <img 
      src={fillaSvg} 
      alt="Filla" 
      className={cn('inline-block', className)}
      style={{ width: size, height: size }}
    />
  );
};

