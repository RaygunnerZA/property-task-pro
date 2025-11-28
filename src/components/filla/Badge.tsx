import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'warning' | 'success' | 'signal' | 'ai';
  size?: 'standard' | 'bold';
  className?: string;
}

/**
 * Badge/Chip component for status indicators
 */
export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'neutral', 
  size = 'standard',
  className = ''
}) => {
  const variants = {
    neutral: 'bg-card border-concrete text-muted-foreground shadow-e1',
    warning: 'bg-warning/20 border-warning/30 text-yellow-700 shadow-sm',
    success: 'bg-success/20 border-success/30 text-green-700 shadow-sm',
    signal: 'bg-signal text-ink border-white/40 shadow-sm',
    ai: 'bg-accent/10 text-accent border-accent/20 shadow-sm'
  };
  
  const sizes = {
    standard: 'px-3 py-1 text-[11px] font-mono uppercase tracking-wide font-medium',
    bold: 'px-3 py-1 text-[11px] font-bold uppercase tracking-wide'
  };
  
  return (
    <span className={cn(
      'inline-flex items-center justify-center rounded-full border',
      variants[variant],
      sizes[size],
      className
    )}>
      {children}
    </span>
  );
};
