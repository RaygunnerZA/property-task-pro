import React from 'react';
import { cn } from '@/lib/utils';

export interface SurfaceProps {
  children?: React.ReactNode;
  variant?: 'floating' | 'neomorphic' | 'engraved' | 'timeline';
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}

/**
 * Surface component - Filla's neomorphic paper card system
 * 
 * Variants:
 * - floating: E3 elevation for modals/popovers (highest depth)
 * - neomorphic: E2 elevation for standard cards (default)
 * - engraved: E-1 for inputs and wells (inset)
 * - timeline: Special style for timeline items
 */
export const Surface: React.FC<SurfaceProps> = ({ 
  children, 
  variant = 'neomorphic', 
  className = '', 
  onClick, 
  interactive = false 
}) => {
  
  const variants = {
    // E3 Floating: Modals, Popovers. High depth.
    floating: 'bg-card rounded-xl shadow-e3 shadow-paper-edge',
    
    // E2 Raised Card: Default. Warm grain + white highlight.
    neomorphic: 'bg-card rounded-sharp shadow-e2 shadow-paper-edge',
    
    // E-1 Engraved: Inputs, Wells.
    engraved: 'bg-transparent rounded-sharp shadow-engraved border border-concrete',
    
    // Timeline: Special variant
    timeline: 'bg-background rounded-sharp shadow-e2 border border-white/60',
  };

  const interactiveStyles = interactive || onClick 
    ? 'cursor-pointer hover:-translate-y-[1px] hover:shadow-lg transition-all duration-200 active:scale-[0.99] active:translate-y-0' 
    : '';

  return (
    <div 
      onClick={onClick}
      className={cn(
        variants[variant],
        'relative overflow-hidden',
        interactiveStyles,
        className
      )}
    >
      {children}
    </div>
  );
};

// Alias for backward compatibility
export const Card = Surface;
