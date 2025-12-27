import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'primary' | 'warning' | 'success' | 'signal' | 'ai' | 'danger';
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
    primary: 'bg-primary/10 border-primary/20 text-primary shadow-sm',
    warning: 'badge-warning shadow-sm',
    success: 'badge-success shadow-sm',
    signal: 'bg-signal text-signal-foreground border-white/40 shadow-sm',
    ai: 'bg-accent/10 text-accent border-accent/20 shadow-sm',
    danger: 'badge-danger shadow-sm'
  };
  
  const sizes = {
    standard: 'px-3 py-1 text-[11px] font-mono uppercase tracking-wide font-medium',
    bold: 'px-3 py-1 text-[11px] font-bold uppercase tracking-wide'
  };
  
  return (
    <span className={cn(
      'inline-flex items-center justify-center rounded-[5px] border',
      variants[variant],
      sizes[size],
      className
    )}>
      {children}
    </span>
  );
};
