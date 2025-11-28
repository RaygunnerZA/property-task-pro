import React from 'react';
import { cn } from '@/lib/utils';

// === TEXT COMPONENT ===
interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'body' | 'label' | 'caption' | 'mono' | 'muted';
  as?: 'p' | 'span' | 'div' | 'label';
}

export const Text: React.FC<TextProps> = ({ 
  variant = 'body', 
  as: Component = 'p', 
  className = '', 
  ...props 
}) => {
  const styles = {
    body: 'text-ink text-base leading-relaxed tracking-tight font-sans',
    label: 'text-ink text-[13px] font-semibold leading-normal font-sans',
    caption: 'text-muted-foreground text-xs leading-normal tracking-tight font-sans',
    mono: 'text-muted-foreground text-[11px] font-mono uppercase tracking-wide font-medium',
    muted: 'text-muted-foreground text-base leading-relaxed tracking-tight font-sans',
  };
  
  return <Component className={cn(styles[variant], className)} {...(props as any)} />;
};

// === HEADING COMPONENT ===
interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  variant?: 'xl' | 'l' | 'm';
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}

export const Heading: React.FC<HeadingProps> = ({ 
  variant = 'l', 
  as, 
  className = '', 
  ...props 
}) => {
  const Component = as || (variant === 'xl' ? 'h1' : variant === 'l' ? 'h2' : 'h3');
  
  const styles = {
    xl: 'text-4xl font-bold tracking-tight leading-tight text-primary-deep',
    l: 'text-2xl font-semibold tracking-tight leading-tight text-primary-deep',
    m: 'text-lg font-semibold tracking-tight leading-snug text-ink',
  };
  
  return <Component className={cn(styles[variant], className)} {...props} />;
};
