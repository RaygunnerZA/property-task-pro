import React from 'react';
import { cn } from '@/lib/utils';

// === INPUT ===
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => (
    <div className="relative w-full">
      <input 
        ref={ref}
        {...props}
        className={cn(
          'w-full bg-input border-none rounded-sharp px-4 py-3 text-foreground',
          'placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20',
          'font-mono text-sm transition-all shadow-engraved border border-white/50',
          'input-neomorphic',
          props.className
        )}
      />
    </div>
  )
);

Input.displayName = 'Input';

// === TEXTAREA ===
export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => (
    <div className="relative w-full">
      <textarea 
        ref={ref}
        {...props}
        className={cn(
          'w-full bg-input border-none rounded-sharp px-4 py-3 text-foreground',
          'placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20',
          'font-sans text-sm transition-all shadow-engraved border border-white/50 resize-none',
          'input-neomorphic',
          props.className
        )}
      />
    </div>
  )
);

TextArea.displayName = 'TextArea';
