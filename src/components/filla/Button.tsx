import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'signal' | 'fab';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Button component - Filla's button system
 * 
 * Variants:
 * - primary: Teal background (main actions)
 * - secondary: White with border (cancel, secondary actions)
 * - ghost: Transparent (tertiary actions)
 * - danger: Red tint (destructive actions)
 * - signal: Warm orange signal (urgent actions)
 * - fab: Floating action button (coral accent, circular)
 */
export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon, 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const base = `inline-flex items-center justify-center font-semibold tracking-tight transition-all duration-150 rounded-button disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]`;
  
  const variants = {
    primary: 'bg-primary text-primary-foreground shadow-primary-btn hover:brightness-105',
    secondary: 'bg-card text-ink shadow-e1 border border-concrete hover:bg-white hover:shadow-e2',
    ghost: 'bg-transparent text-ink/60 hover:bg-black/5 hover:text-ink shadow-none',
    danger: 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 shadow-sm',
    signal: 'bg-signal text-ink shadow-e2 border border-white/40 hover:brightness-105',
    fab: 'bg-accent text-white shadow-fab hover:brightness-110 border border-white/20 z-20',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-3 text-sm gap-2',
    lg: 'px-8 py-4 text-base gap-3',
  };

  const sizeClasses = variant === 'fab' 
    ? 'w-16 h-16 rounded-full p-0 flex items-center justify-center' 
    : `${sizes[size]} ${fullWidth ? 'w-full' : ''}`;

  return (
    <button 
      className={cn(base, variants[variant], sizeClasses, className)} 
      {...props}
    >
      {icon && <span className={variant === 'fab' ? '' : 'opacity-90'}>{icon}</span>}
      {children}
    </button>
  );
};

// === ICON BUTTON ===
export const IconButton: React.FC<ButtonProps> = ({ className = '', ...props }) => {
  return <Button className={cn('p-2 aspect-square rounded-full', className)} {...props} />;
};
