/**
 * InteractiveChipView - Everything pressable
 *
 * Contract:
 * - Elevation token E1 (lighter than fact)
 * - Opacity ~0.75
 * - No dashed borders
 * - Same shape as fact
 * - Press → inset shadow (90ms)
 * - Blocking flag affects submit validation only, not visual style
 */

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import type { InteractiveKind } from "@/types/task-chip";

export interface InteractiveChipViewProps {
  label: string;
  kind: InteractiveKind;
  blocking?: boolean;
  onPress: () => void;
  className?: string;
}

export function InteractiveChipView({
  label,
  kind,
  blocking = false,
  onPress,
  className,
}: InteractiveChipViewProps) {
  const [isPressed, setIsPressed] = useState(false);

  const handlePointerDown = () => {
    setIsPressed(true);
  };

  const handlePointerUp = () => {
    setTimeout(() => setIsPressed(false), 90);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPress();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => setIsPressed(false)}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 h-[24px] rounded-[8px]",
        "font-mono text-[11px] uppercase tracking-wide",
        "bg-background text-muted-foreground",
        "shadow-e1 opacity-75",
        "transition-all duration-[90ms]",
        "cursor-pointer select-none",
        isPressed && "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
        !isPressed && "hover:opacity-90",
        className
      )}
    >
      <span className="truncate max-w-[120px] flex-1">{label}</span>
    </button>
  );
}
