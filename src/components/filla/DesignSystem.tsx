/**
 * Filla Design System v4.0 - Swiss Neomorphic Edition
 * Centralized design tokens and component library
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════
// COLOR TOKENS (HSL)
// ═══════════════════════════════════════════════════════════════════════════

export const colors = {
  // Warm neutrals
  background: 'hsl(40, 20%, 94%)',      // #F1EEE8 - Warm off-white
  surface: 'hsl(0, 0%, 100%)',          // #FFFFFF - Pure white
  surfaceRaised: 'hsl(40, 15%, 96%)',   // Slightly raised surface
  concrete: 'hsl(40, 12%, 88%)',        // #E3DFD7 - Border gray
  
  // Typography
  ink: 'hsl(248, 15%, 18%)',            // #2A293E - Dark text
  textMuted: 'hsl(40, 2%, 55%)',        // #8C8C85 - Muted gray
  textLight: 'hsl(40, 5%, 70%)',        // Light gray for captions
  
  // Accent colors
  primary: 'hsl(182, 29%, 63%)',        // #8EC9CE - Muted teal
  primaryDeep: 'hsl(182, 23%, 56%)',    // Deep teal
  accent: 'hsl(16, 83%, 56%)',          // #EB6834 - Coral
  accentLight: 'hsl(16, 100%, 95%)',    // Light coral
  
  // Status
  danger: 'hsl(0, 84%, 60%)',           // Red
  warning: 'hsl(43, 100%, 85%)',        // Yellow
  success: 'hsl(145, 62%, 85%)',        // Green
  signal: 'hsl(30, 100%, 91%)',         // Warm signal
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// SHADOWS (Neomorphic)
// ═══════════════════════════════════════════════════════════════════════════

export const shadows = {
  // Inset shadow (pressed/engraved)
  inset: 'inset 2px 2px 6px rgba(0,0,0,0.08), inset -2px -2px 6px rgba(255,255,255,0.7)',
  
  // Outset shadow (raised/elevated)
  outset: '0px 2px 6px rgba(0,0,0,0.08), 0px 1px 2px rgba(0,0,0,0.04)',
  
  // Card elevation
  card: '0px 4px 12px rgba(0,0,0,0.06), 0px 2px 4px rgba(0,0,0,0.04)',
  
  // Floating elements (modals, popovers)
  floating: '0px 12px 32px rgba(0,0,0,0.12), 0px 4px 12px rgba(0,0,0,0.08)',
  
  // FAB shadow
  fab: '0px 8px 24px rgba(235,104,52,0.4), 0px 4px 8px rgba(235,104,52,0.3)',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY
// ═══════════════════════════════════════════════════════════════════════════

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
  },
  
  // Type scale
  headingXL: 'text-4xl font-bold tracking-tight leading-tight',
  headingL: 'text-2xl font-semibold tracking-tight leading-tight',
  headingM: 'text-lg font-semibold tracking-tight leading-snug',
  headingS: 'text-base font-semibold tracking-tight leading-snug',
  
  body: 'text-base leading-relaxed tracking-tight',
  bodySmall: 'text-sm leading-normal',
  caption: 'text-xs leading-normal tracking-tight',
  mono: 'text-[11px] font-mono uppercase tracking-wide font-medium',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// SPACING & SIZING
// ═══════════════════════════════════════════════════════════════════════════

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '0.75rem',   // 12px
  lg: '1rem',      // 16px
  xl: '1.5rem',    // 24px
  '2xl': '2rem',   // 32px
  '3xl': '3rem',   // 48px
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// BORDER RADIUS
// ═══════════════════════════════════════════════════════════════════════════

export const radii = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  full: '9999px',
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// MOTION PRESETS
// ═══════════════════════════════════════════════════════════════════════════

export const motion = {
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
  
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  
  // Transition presets
  transition: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT LIBRARY
// ═══════════════════════════════════════════════════════════════════════════

// Surface Component
interface SurfaceProps {
  children: React.ReactNode;
  variant?: 'flat' | 'raised' | 'inset';
  className?: string;
  onClick?: () => void;
}

export const Surface: React.FC<SurfaceProps> = ({ 
  children, 
  variant = 'raised', 
  className = '',
  onClick 
}) => {
  const variants = {
    flat: 'bg-surface',
    raised: 'bg-surface',
    inset: 'bg-background',
  };
  
  const shadowVariants = {
    flat: '',
    raised: shadows.outset,
    inset: shadows.inset,
  };
  
  return (
    <div 
      onClick={onClick}
      className={cn(
        'rounded-lg transition-all duration-200',
        variants[variant],
        className
      )}
      style={{ boxShadow: shadowVariants[variant] }}
    >
      {children}
    </div>
  );
};

// Text Component
interface TextProps {
  children: React.ReactNode;
  variant?: 'body' | 'bodySmall' | 'caption' | 'mono' | 'muted';
  className?: string;
  as?: 'p' | 'span' | 'div';
}

export const Text: React.FC<TextProps> = ({ 
  children, 
  variant = 'body', 
  className = '',
  as: Component = 'p'
}) => {
  const variants = {
    body: cn(typography.body, 'text-ink'),
    bodySmall: cn(typography.bodySmall, 'text-ink'),
    caption: cn(typography.caption, 'text-textLight'),
    mono: cn(typography.mono, 'text-textMuted'),
    muted: cn(typography.body, 'text-textMuted'),
  };
  
  return (
    <Component className={cn(variants[variant], className)}>
      {children}
    </Component>
  );
};

// Heading Component
interface HeadingProps {
  children: React.ReactNode;
  variant?: 'xl' | 'l' | 'm' | 's';
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}

export const Heading: React.FC<HeadingProps> = ({ 
  children, 
  variant = 'l', 
  className = '',
  as 
}) => {
  const Component = as || (variant === 'xl' ? 'h1' : variant === 'l' ? 'h2' : variant === 'm' ? 'h3' : 'h4');
  
  const variants = {
    xl: cn(typography.headingXL, 'text-ink'),
    l: cn(typography.headingL, 'text-ink'),
    m: cn(typography.headingM, 'text-ink'),
    s: cn(typography.headingS, 'text-ink'),
  };
  
  return (
    <Component className={cn(variants[variant], className)}>
      {children}
    </Component>
  );
};

// Button Component
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  disabled = false
}) => {
  const variants = {
    primary: 'bg-primary text-white hover:brightness-110',
    secondary: 'bg-surface text-ink hover:bg-surfaceRaised',
    ghost: 'bg-transparent text-ink hover:bg-surface',
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'rounded-lg font-semibold transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'active:scale-95',
        variants[variant],
        sizes[size],
        className
      )}
      style={{ boxShadow: variant !== 'ghost' ? shadows.outset : 'none' }}
    >
      {children}
    </button>
  );
};

// Badge Component
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'primary' | 'danger' | 'warning' | 'success';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'neutral',
  className = ''
}) => {
  const variants = {
    neutral: 'bg-concrete text-textMuted',
    primary: 'bg-primary/10 text-primaryDeep border-primary/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    warning: 'bg-warning/20 text-yellow-700 border-warning/30',
    success: 'bg-success/20 text-green-700 border-success/30',
  };
  
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM PREVIEW
// ═══════════════════════════════════════════════════════════════════════════

export const DesignSystemPreview: React.FC = () => {
  return (
    <div className="p-8 space-y-12 bg-background min-h-screen">
      <div>
        <Heading variant="xl">Filla Design System v4.0</Heading>
        <Text variant="muted" className="mt-2">Swiss Neomorphic Edition</Text>
      </div>
      
      {/* Colors */}
      <section className="space-y-4">
        <Heading variant="l">Colors</Heading>
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="h-16 rounded-lg" style={{ backgroundColor: colors.background }}></div>
            <Text variant="caption">Background</Text>
          </div>
          <div className="space-y-2">
            <div className="h-16 rounded-lg border" style={{ backgroundColor: colors.surface }}></div>
            <Text variant="caption">Surface</Text>
          </div>
          <div className="space-y-2">
            <div className="h-16 rounded-lg" style={{ backgroundColor: colors.primary }}></div>
            <Text variant="caption">Primary</Text>
          </div>
          <div className="space-y-2">
            <div className="h-16 rounded-lg" style={{ backgroundColor: colors.accent }}></div>
            <Text variant="caption">Accent</Text>
          </div>
        </div>
      </section>
      
      {/* Typography */}
      <section className="space-y-4">
        <Heading variant="l">Typography</Heading>
        <div className="space-y-3">
          <Heading variant="xl">Heading XL</Heading>
          <Heading variant="l">Heading L</Heading>
          <Heading variant="m">Heading M</Heading>
          <Heading variant="s">Heading S</Heading>
          <Text variant="body">Body text with regular weight</Text>
          <Text variant="bodySmall">Small body text</Text>
          <Text variant="caption">Caption text for metadata</Text>
          <Text variant="mono">MONO TEXT</Text>
        </div>
      </section>
      
      {/* Surfaces */}
      <section className="space-y-4">
        <Heading variant="l">Surfaces</Heading>
        <div className="grid grid-cols-3 gap-4">
          <Surface variant="flat" className="p-6">
            <Text variant="caption">Flat</Text>
          </Surface>
          <Surface variant="raised" className="p-6">
            <Text variant="caption">Raised</Text>
          </Surface>
          <Surface variant="inset" className="p-6">
            <Text variant="caption">Inset</Text>
          </Surface>
        </div>
      </section>
      
      {/* Buttons */}
      <section className="space-y-4">
        <Heading variant="l">Buttons</Heading>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </section>
      
      {/* Badges */}
      <section className="space-y-4">
        <Heading variant="l">Badges</Heading>
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="success">Success</Badge>
        </div>
      </section>
    </div>
  );
};
