import React from 'react';
import { cn } from '@/lib/utils';

// AI Wedge SVG Component
const AIWedge = ({ size = 13 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 13 13" 
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M0 0 V13 C6 13 13 6 13 0 H0 Z" />
  </svg>
);

export interface AIChipProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'solid' | 'subtle';
  size?: 'standard' | 'small';
  fullWidth?: boolean;
}

/**
 * AIChip - Special chip for AI-generated content
 * Features the signature wedge decoration
 */
export const AIChip: React.FC<AIChipProps> = ({ 
  children, 
  onClick, 
  className = '', 
  variant = 'solid', 
  size = 'standard', 
  fullWidth = false 
}) => {
  
  const styles = {
    solid: {
      chip: 'bg-accent text-white font-medium border-white/20',
      wedge: 'text-accent',
      wedgePosition: 'absolute bottom-0 -left-[12px]'
    },
    subtle: {
      chip: 'bg-card text-ink font-medium border-white shadow-e2',
      wedge: 'text-card',
      wedgePosition: 'absolute left-0'
    }
  };

  const sizes = {
    standard: 'px-4 py-2 text-xs tracking-wide',
    small: 'px-2 py-1 text-[10px] tracking-wide'
  };

  const currentStyle = styles[variant];
  const currentSize = sizes[size];
  const wedgeSize = size === 'small' ? 9 : 13;

  let wedgePosClass = currentStyle.wedgePosition;
  if (variant === 'subtle') {
    const bottomOffset = size === 'small' ? '-bottom-[7px]' : '-bottom-[12px]';
    wedgePosClass = `${wedgePosClass} ${bottomOffset}`;
  }

  const shadowClass = size === 'small' ? 'shadow-[0_2px_5px_rgba(0,0,0,0.04)]' : 'shadow-fab';
  const shape = 'rounded-sharp rounded-bl-none';
  const displayClass = fullWidth ? 'flex w-full' : 'inline-flex';

  return (
    <div 
      onClick={onClick} 
      className={cn(
        'relative group cursor-pointer',
        displayClass,
        variant === 'subtle' ? 'mb-2' : '',
        className
      )}
    >
      <div className={cn(
        currentStyle.chip,
        currentSize,
        shape,
        shadowClass,
        'relative z-10 transition-transform active:scale-95 border',
        fullWidth ? 'w-full' : ''
      )}>
        {children}
      </div>
      <div className={cn(wedgePosClass, 'z-0 filter drop-shadow-sm', currentStyle.wedge)}>
        <AIWedge size={wedgeSize} />
      </div>
    </div>
  );
};
