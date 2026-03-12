/**
 * SemanticChip - Unified chip for fact vs proposal epistemic states.
 *
 * Epistemic: fact (committed) | proposal (suggested)
 * Interaction: idle | entry (input mode)
 * Size: default | compact
 *
 * Rules: fact+entry invalid, compact+entry invalid.
 */

import React, { useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type EpistemicState = "fact" | "proposal";
export type InteractionState = "idle" | "entry";
export type ChipSize = "default" | "compact";

export interface SemanticChipProps {
  epistemic: EpistemicState;
  interaction?: InteractionState;
  size?: ChipSize;
  label?: string;
  removable?: boolean;
  pending?: boolean;
  dropdown?: boolean;
  dropdownContent?: React.ReactNode;
  onDropdownOpenChange?: (open: boolean) => void;
  onPress?: () => void;
  /** When true, trigger onPress on pointer-down (prevents scroll-cancelled clicks in overflow-x rows). */
  pressOnPointerDown?: boolean;
  onRemove?: () => void;
  onCommit?: (value: string) => void;
  onCancel?: () => void;
  animateIn?: boolean;
  icon?: React.ReactNode;
  color?: string;
  /** When false, label uses natural width (no truncation). Use for instruction chips. */
  truncate?: boolean;
  className?: string;
}

export function SemanticChip({
  epistemic,
  interaction = "idle",
  size = "default",
  label = "",
  removable = false,
  pending = false,
  dropdown = false,
  dropdownContent,
  onDropdownOpenChange,
  onPress,
  pressOnPointerDown = false,
  onRemove,
  onCommit,
  onCancel,
  animateIn = false,
  icon,
  color,
  truncate = true,
  className,
}: SemanticChipProps) {
  const [isPressed, setIsPressed] = useState(false);
  const firedOnPointerDown = useRef(false);

  if (epistemic === "fact" && interaction === "entry") {
    if (process.env.NODE_ENV === "development") {
      console.warn("[SemanticChip] fact + entry is invalid");
    }
  }
  if (size === "compact" && interaction === "entry") {
    if (process.env.NODE_ENV === "development") {
      console.warn("[SemanticChip] compact + entry is invalid");
    }
  }

  const handlePointerDown = (e?: React.PointerEvent) => {
    setIsPressed(true);
    if (pressOnPointerDown && onPress) {
      firedOnPointerDown.current = true;
      e?.stopPropagation();
      onPress();
    }
  };
  const handlePointerUp = () => setTimeout(() => setIsPressed(false), 90);
  const handleClick = (e: React.MouseEvent) => {
    if (firedOnPointerDown.current) {
      firedOnPointerDown.current = false;
      return;
    }
    if (onPress) {
      e.stopPropagation();
      onPress();
    }
  };
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  const heightClass = size === "compact" ? "h-[20px]" : "h-[24px]";
  const textClass = size === "compact" ? "text-[10px]" : "text-[11px]";

  const epistemicStyles =
    epistemic === "fact"
      ? "bg-card text-foreground"
      : "bg-background text-muted-foreground shadow-e1 opacity-75";

  const interactionStyles =
    interaction === "entry"
      ? "shadow-inset bg-background"
      : isPressed && onPress
        ? "shadow-inset"
        : "";

  const baseStyles = cn(
    "relative inline-flex items-center gap-1.5 rounded-[8px] flex-shrink-0",
    "font-mono uppercase tracking-wide whitespace-nowrap",
    "transition-[padding] duration-[120ms] ease-out",
    heightClass,
    textClass,
    epistemicStyles,
    interactionStyles,
    epistemic === "fact" && "px-[10px] min-w-[40px] max-w-[120px]",
    epistemic === "proposal" && "px-2 py-1 max-w-[160px]",
    epistemic === "fact" && !onPress && !dropdown && "cursor-default",
    epistemic === "fact" && removable && "overflow-visible pr-[10px] hover:pr-[35px]",
    (onPress || dropdown) && "cursor-pointer select-none",
    onPress && !isPressed && "hover:opacity-90",
    pending && "opacity-75 text-muted-foreground",
    (removable || dropdown) && "group",
    animateIn && "animate-fade-slide-in",
    className
  );

  const content = (
    <>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {pending && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70 flex-shrink-0" />
      )}
      <span className={cn(truncate && "min-w-0 truncate flex-1", !truncate && "flex-1")}>{label}</span>
      {removable && onRemove && epistemic === "fact" && (
        <span
          role="button"
          tabIndex={0}
          onClick={handleRemove}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRemove(e as unknown as React.MouseEvent); } }}
          className="absolute right-[15px] top-0 bottom-0 flex items-center pointer-events-none group-hover:pointer-events-auto text-current opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity duration-[120ms] flex-shrink-0 w-3 inline-flex items-center justify-center"
        >
          <X className="h-3 w-3" />
        </span>
      )}
      {dropdown && (
        <span
          className={cn(
            "flex items-center justify-end flex-shrink-0 overflow-hidden transition-[width] duration-150",
            "w-0 group-hover:w-[20px] group-data-[state=open]:w-[20px]"
          )}
        >
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform duration-150" />
        </span>
      )}
    </>
  );

  if (dropdown && dropdownContent) {
    return (
      <DropdownMenu onOpenChange={onDropdownOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={baseStyles}
            style={color ? { backgroundColor: color } : undefined}
            aria-expanded={undefined}
            aria-haspopup="true"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => setIsPressed(false)}
          >
            {content}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          sideOffset={4}
          className="min-w-[160px] p-0 text-[10px]"
        >
          {dropdownContent}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const Wrapper = onPress ? "button" : "span";
  return (
    <Wrapper
      type={onPress ? "button" : undefined}
      onClick={onPress ? handleClick : undefined}
      onPointerDown={onPress ? handlePointerDown : undefined}
      onPointerUp={onPress ? handlePointerUp : undefined}
      onPointerLeave={onPress ? () => setIsPressed(false) : undefined}
      className={baseStyles}
      style={color ? { backgroundColor: color } : undefined}
    >
      {content}
    </Wrapper>
  );
}
