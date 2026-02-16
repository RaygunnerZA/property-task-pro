/**
 * InstructionField - Instruction text to the right of fact chips.
 * On click, becomes an editable text field.
 * Aligned left within its container.
 */

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface InstructionFieldProps {
  /** Default/placeholder instruction text */
  value: string;
  /** Callback when value changes (e.g. on blur) */
  onChange?: (value: string) => void;
  /** When provided, click triggers this instead of entering edit mode (e.g. open add-person popover) */
  onPress?: () => void;
  /** Called when entering edit mode (so parent can keep field visible on mouse leave) */
  onEditStart?: () => void;
  /** Called when leaving edit mode (blur/escape) */
  onEditEnd?: () => void;
  className?: string;
}

export function InstructionField({
  value,
  onChange,
  onPress,
  onEditStart,
  onEditEnd,
  className,
}: InstructionFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) setEditValue(value);
  }, [value, isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    onEditEnd?.();
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onChange?.(trimmed);
    }
    setEditValue(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setEditValue(value);
      setIsEditing(false);
      onEditEnd?.();
      inputRef.current?.blur();
    }
  };

  const displayText = value || "Add instruction…";

  return (
    <div className={cn("shrink-0 min-w-0 flex items-center justify-start text-left", className)}>
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Add instruction…"
          className={cn(
            "h-[24px] min-w-[100px] max-w-[180px] rounded-[8px] px-2 py-1",
            "font-mono text-[11px] uppercase tracking-wide",
            "bg-background text-muted-foreground/80 placeholder:text-muted-foreground/50",
            "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
            "outline-none cursor-text border-0"
          )}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            if (onPress) {
              onPress();
            } else {
              setEditValue(value || "");
              setIsEditing(true);
              onEditStart?.();
            }
          }}
          className={cn(
            "h-[24px] px-2 py-1 rounded-[8px] text-left truncate max-w-[180px]",
            "font-mono text-[11px] uppercase tracking-wide",
            "text-muted-foreground/80 hover:text-muted-foreground",
            "bg-background/60 hover:bg-background/80 shadow-e1",
            "transition-all duration-150 cursor-pointer",
            "hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.2)]"
          )}
        >
          {displayText}
        </button>
      )}
    </div>
  );
}
