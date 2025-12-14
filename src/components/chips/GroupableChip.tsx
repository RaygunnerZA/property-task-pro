import React, { useState, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GroupableChipProps {
  label: string;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  onLongPress?: () => void;
  variant?: "person" | "team" | "group" | "ghost";
  className?: string;
}

/**
 * GroupableChip - Neomorphic tactile chip following Filla design rules
 * - Rounded rectangle (8px radius)
 * - JetBrains Mono CAPS
 * - E1 baseline, E2 on hover/active
 * - Paper texture background
 */
export function GroupableChip({
  label,
  selected = false,
  onSelect,
  onRemove,
  onLongPress,
  variant = "person",
  className,
}: GroupableChipProps) {
  const [isPressed, setIsPressed] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const LONG_PRESS_DURATION = 500;

  const handleMouseDown = useCallback(() => {
    setIsPressed(true);
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress();
      }, LONG_PRESS_DURATION);
    }
  }, [onLongPress]);

  const handleMouseUp = useCallback(() => {
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(() => {
    setIsPressed(true);
    if (onLongPress) {
      longPressTimer.current = setTimeout(() => {
        onLongPress();
      }, LONG_PRESS_DURATION);
    }
  }, [onLongPress]);

  const handleTouchEnd = useCallback(() => {
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const variantStyles = {
    person: "bg-primary/10 text-primary border-primary/20",
    team: "bg-accent/10 text-accent border-accent/20",
    group: "bg-muted text-muted-foreground border-muted-foreground/20",
    ghost: "bg-transparent text-muted-foreground/50 border-dashed border-muted-foreground/30",
  };

  const selectedStyles = selected
    ? "bg-primary text-primary-foreground border-primary shadow-e2"
    : "";

  const pressedStyles = isPressed ? "shadow-engraved scale-[0.98]" : "";

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn(
        // Base styles
        "inline-flex items-center gap-1.5 px-3 py-1.5",
        "rounded-[5px] border",
        "font-mono text-xs uppercase tracking-wide",
        "transition-all duration-150 ease-out",
        "cursor-pointer select-none",
        // Variant styles
        variantStyles[variant],
        // Selected state
        selectedStyles,
        // Pressed state
        pressedStyles,
        className
      )}
    >
      <span className="truncate max-w-[120px]">{label}</span>
      
      {/* Remove button (only when selected and onRemove provided) */}
      {selected && onRemove && (
        <X
          className="h-3 w-3 opacity-70 hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      )}
    </button>
  );
}
