/**
 * FactChipView - Resolved entity chip
 *
 * Contract:
 * - Elevation token E2
 * - Full opacity
 * - Pending state = subtle dot or muted text
 * - Click = re-enter editing
 * - On press: 120ms transition to editing state, 150ms crossfade
 */

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FactChipViewProps {
  label: string;
  pending?: boolean;
  onRemove?: () => void;
  onPress?: () => void;
  className?: string;
}

export function FactChipView({
  label,
  pending = false,
  onRemove,
  onPress,
  className,
}: FactChipViewProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (onPress) {
      e.stopPropagation();
      onPress();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  const Wrapper = onPress ? "button" : "span";

  return (
    <Wrapper
      type={onPress ? "button" : undefined}
      onClick={onPress ? handleClick : undefined}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-2 py-1 h-[28px] rounded-[8px]",
        "font-mono text-[11px] uppercase tracking-wide",
        "bg-card text-foreground",
        "shadow-e2",
        "transition-all duration-[120ms]",
        onPress && "cursor-pointer hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
        !onPress && "cursor-default overflow-visible pr-2 hover:pr-6",
        onRemove && "group",
        pending && "opacity-75 text-muted-foreground",
        className
      )}
    >
      {pending && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70 flex-shrink-0" />
      )}
      <span className="truncate max-w-[120px] flex-1">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute right-2 top-0 bottom-0 flex items-center pointer-events-none group-hover:pointer-events-auto text-current opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 -m-0.5 inline-flex items-center justify-center"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Wrapper>
  );
}
