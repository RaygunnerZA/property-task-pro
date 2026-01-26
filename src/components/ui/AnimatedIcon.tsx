import { motion, HTMLMotionProps } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface AnimatedIconProps extends Omit<HTMLMotionProps<'div'>, 'animate' | 'children'> {
  icon: LucideIcon | ReactNode;
  size?: number;
  className?: string;
  animateOnHover?: boolean;
  animateOnTap?: boolean;
  animation?: 'scale' | 'rotate' | 'bounce' | 'pulse' | 'path-draw' | 'pointing' | 'shake' | 'check';
  persistOnAnimateEnd?: boolean;
  initial?: 'complete' | 'incomplete';
  loop?: boolean;
}

/**
 * AnimatedIcon - Wrapper for Lucide icons with custom Framer Motion animations
 * Inspired by animate-ui.com pattern with icon-specific animations
 * 
 * Supports:
 * - path-draw: Draws icon path on hover (like animate-ui)
 * - pointing: Icon points/shifts right on hover
 * - shake: Icon shakes on hover
 * - scale/rotate/bounce/pulse effects
 */
export function AnimatedIcon({
  icon: Icon,
  size = 20,
  className,
  animateOnHover = false,
  animateOnTap = false,
  animation = 'scale',
  persistOnAnimateEnd = false,
  initial = 'incomplete',
  loop = false,
  ...props
}: AnimatedIconProps) {
  // Determine if Icon is a React component
  const isComponent = typeof Icon === 'function' || 
    (Icon && typeof Icon === 'object' && '$$typeof' in Icon);

  // Enhanced animation variants with custom animations
  const variants = {
    scale: {
      hover: { scale: 1.15, transition: { duration: 0.2, ease: "easeOut" } },
      tap: { scale: 0.9, transition: { duration: 0.1 } },
      rest: { scale: 1 },
    },
    rotate: {
      hover: { rotate: [0, -12, 12, -8, 8, 0], transition: { duration: 0.6, ease: "easeInOut" } },
      tap: { rotate: -15, transition: { duration: 0.2 } },
      rest: { rotate: 0 },
    },
    bounce: {
      hover: { 
        y: [0, -6, 6, -3, 0],
        transition: { duration: 0.7, ease: "easeOut" }
      },
      tap: { scale: 0.85, y: 2, transition: { duration: 0.1 } },
      rest: { y: 0, scale: 1 },
    },
    pulse: {
      hover: { 
        scale: [1, 1.25, 1],
        transition: { duration: 0.6, repeat: loop ? Infinity : 0, ease: "easeInOut" }
      },
      tap: { scale: 0.9, transition: { duration: 0.1 } },
      rest: { scale: 1 },
    },
    'path-draw': {
      hover: { 
        // Animate scale and opacity to simulate path drawing
        scale: [0.8, 1.1, 1],
        opacity: [0.3, 1],
        transition: { 
          duration: 0.5,
          scale: { duration: 0.6, ease: "easeOut" },
          opacity: { duration: 0.3 }
        }
      },
      tap: { scale: 0.9, transition: { duration: 0.1 } },
      rest: { scale: 1, opacity: 1 },
    },
    pointing: {
      hover: { 
        x: [0, 4, 2, 4, 0],
        transition: { 
          duration: 0.6, 
          repeat: loop ? Infinity : 0, 
          ease: "easeInOut" 
        }
      },
      tap: { x: 6, transition: { duration: 0.1 } },
      rest: { x: 0 },
    },
    shake: {
      hover: { 
        rotate: [0, -10, 10, -10, 10, -5, 5, 0],
        x: [0, -2, 2, -2, 2, 0],
        transition: { duration: 0.5, ease: "easeInOut" }
      },
      tap: { rotate: -12, scale: 0.9, transition: { duration: 0.1 } },
      rest: { rotate: 0, x: 0, scale: 1 },
    },
    check: {
      complete: {
        scale: [0, 1.2, 1],
        opacity: [0, 1],
        transition: { 
          duration: 0.4,
          ease: "easeOut"
        }
      },
      incomplete: {
        scale: 1,
        opacity: 0.5,
      },
      hover: {
        scale: 1.15,
        transition: { duration: 0.2 }
      },
      tap: {
        scale: 0.9,
        transition: { duration: 0.1 }
      },
    },
  };

  const currentVariant = animation === 'check' 
    ? variants.check[initial]
    : variants[animation];

  // Extract color/text classes from className to apply to icon
  const colorClasses = className?.match(/\b(text-|bg-)/g)?.join(' ') || '';
  const spacingClasses = className?.replace(/\b(text-|bg-)[^\s]*/g, '').trim() || '';

  // For path-draw animation, add CSS class for SVG path animation
  const pathDrawClass = animation === 'path-draw' && animateOnHover 
    ? '[&_svg_path]:transition-all [&_svg_path]:duration-500 [&_svg_path]:ease-out group-hover:[&_svg_path]:stroke-dasharray-[1] group-hover:[&_svg_path]:stroke-dashoffset-0'
    : '';

  const motionProps: HTMLMotionProps<'div'> = {
    className: cn(
      'inline-flex items-center justify-center group', 
      spacingClasses, 
      animation === 'path-draw' ? 'animate-icon-path-draw' : '',
      pathDrawClass
    ),
    'data-animation': animation === 'path-draw' ? 'path-draw' : undefined,
    whileHover: animateOnHover ? currentVariant?.hover : undefined,
    whileTap: animateOnTap ? currentVariant?.tap : undefined,
    animate: persistOnAnimateEnd ? currentVariant : undefined,
    initial: animation === 'check' ? variants.check[initial] : currentVariant?.rest || {},
    style: { 
      pointerEvents: 'auto',
      ...props.style 
    },
    ...props,
  };

  return (
    <motion.div {...motionProps}>
      {isComponent ? (
        <Icon 
          size={size} 
          className={cn(colorClasses || undefined, 'pointer-events-none')} 
        />
      ) : (
        <div 
          style={{ width: size, height: size }} 
          className={cn(colorClasses || undefined, 'pointer-events-none')}
        >
          {Icon}
        </div>
      )}
    </motion.div>
  );
}
