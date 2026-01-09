import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * CardButton - Standardized button for icons on cards (chevrons, close, etc.)
   * 
   * Normal state: Matches card background, no neumorphic effect
   * Hover state: Pressed neumorphic effect
   * 
   * @example
   * <CardButton aria-label="Close">
   *   <X className="h-6 w-6" />
   * </CardButton>
   * 
   * @example
   * <CardButton aria-label="Previous month">
   *   <ChevronLeft className="h-6 w-6" />
   * </CardButton>
   */
}

/**
 * CardButton className - Reusable className for card buttons
 * Use this when you can't use the CardButton component directly (e.g., react-day-picker)
 */
export const cardButtonClassName = cn(
  "h-10 w-10 rounded-full",
  "bg-card",
  "flex items-center justify-center",
  "transition-all duration-150",
  "hover:bg-surface-gradient hover:shadow-btn-pressed active:shadow-btn-pressed",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  "disabled:pointer-events-none disabled:opacity-50"
);

/**
 * CardButton - Standardized button for icons on cards
 * 
 * Features:
 * - Normal state: bg-card (matches card), no shadow
 * - Hover state: bg-surface-gradient with shadow-btn-pressed (pressed neumorphic)
 * - Standard size: h-10 w-10
 * - Centered icon content
 * - Accessible by default
 */
export const CardButton = React.forwardRef<HTMLButtonElement, CardButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(cardButtonClassName, className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

CardButton.displayName = "CardButton";

