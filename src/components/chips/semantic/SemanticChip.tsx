/**
 * SemanticChip - Unified chip for fact vs proposal epistemic states.
 *
 * Epistemic: fact (committed) | proposal (suggested)
 * Interaction: idle | entry (input mode)
 * Size: default | compact
 *
 * Rules: fact+entry invalid, compact+entry invalid.
 */

import React, { useEffect, useRef, useState } from "react";
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
  /** For proposal chips, collapse horizontally before calling onPress. */
  transferOnPress?: boolean;
  /** Shown when interaction is entry (proposal only). */
  entryPlaceholder?: string;
  entryValue?: string;
  onEntryChange?: (value: string) => void;
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
  transferOnPress = false,
  entryPlaceholder = "",
  entryValue = "",
  onEntryChange,
  className,
}: SemanticChipProps) {
  const TRANSFER_COLLAPSE_MS = 260;
  const [isPressed, setIsPressed] = useState(false);
  const [isTransferCollapsing, setIsTransferCollapsing] = useState(false);
  const firedOnPointerDown = useRef(false);
  const transferTimeoutRef = useRef<number | null>(null);
  const entryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (transferTimeoutRef.current !== null) {
        window.clearTimeout(transferTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (interaction !== "entry") return;
    const id = window.setTimeout(() => entryInputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [interaction]);

  const shouldTransferOnPress = transferOnPress || (epistemic === "proposal" && pressOnPointerDown);
  const triggerPress = (e?: React.SyntheticEvent) => {
    if (!onPress) return;
    e?.stopPropagation();
    if (!shouldTransferOnPress) {
      onPress();
      return;
    }
    if (isTransferCollapsing) return;
    setIsTransferCollapsing(true);
    transferTimeoutRef.current = window.setTimeout(() => {
      onPress();
    }, TRANSFER_COLLAPSE_MS);
  };

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
      triggerPress(e);
    }
  };
  const handlePointerUp = () => setTimeout(() => setIsPressed(false), 90);
  const handleClick = (e: React.MouseEvent) => {
    if (firedOnPointerDown.current) {
      firedOnPointerDown.current = false;
      return;
    }
    if (onPress) {
      triggerPress(e);
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
      ? "shadow-inset bg-background min-w-[140px] max-w-[200px] px-2 animate-in fade-in duration-200"
      : isPressed && onPress
        ? "shadow-inset"
        : "";

  const baseStyles = cn(
    "relative inline-flex items-center gap-1.5 rounded-[8px] flex-shrink-0",
    "font-mono uppercase tracking-wide whitespace-nowrap",
    "transition-[max-width,width] duration-200 ease-out",
    heightClass,
    textClass,
    epistemicStyles,
    interactionStyles,
    epistemic === "fact" && !removable && "px-[10px] min-w-[40px] max-w-[120px]",
    epistemic === "fact" &&
      removable &&
      "pl-[10px] pr-[10px] min-w-[40px] max-w-[200px] group-hover:max-w-none group-hover:z-10",
    epistemic === "proposal" && "px-2 py-1 max-w-[160px]",
    epistemic === "fact" && !onPress && !dropdown && "cursor-default",
    (onPress || dropdown) && "cursor-pointer select-none",
    onPress && !isPressed && "hover:opacity-90",
    pending && "opacity-75 text-muted-foreground",
    (removable || dropdown) && "group",
    animateIn && "origin-left animate-[fade-slide-in_280ms_ease-out]",
    isTransferCollapsing &&
      "absolute z-10 origin-left pointer-events-none animate-[chip-collapse-x_260ms_cubic-bezier(0.22,1,0.36,1)_forwards]",
    className
  );

  const handleEntryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const v = entryValue.trim();
      if (v) onCommit?.(v);
      else onCancel?.();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel?.();
    }
  };

  const content =
    interaction === "entry" ? (
      <input
        ref={entryInputRef}
        type="text"
        value={entryValue}
        onChange={(e) => onEntryChange?.(e.target.value)}
        onKeyDown={handleEntryKeyDown}
        onBlur={() => {
          const v = entryValue.trim();
          if (v) onCommit?.(v);
          else onCancel?.();
        }}
        placeholder={entryPlaceholder}
        className={cn(
          "w-full min-w-0 bg-transparent border-0 outline-none caret-foreground",
          textClass,
          "font-mono uppercase tracking-wide",
          "placeholder:font-mono placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/55"
        )}
        aria-label={entryPlaceholder || "Enter value"}
      />
    ) : (
    <>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {pending && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70 flex-shrink-0" />
      )}
      <span
        className={cn(
          truncate && "min-w-0 truncate",
          removable && truncate && "group-hover:shrink-0",
          !truncate && "flex-1"
        )}
      >
        {label}
      </span>
      {removable && onRemove && epistemic === "fact" && (
        <span
          role="button"
          tabIndex={0}
          onClick={handleRemove}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRemove(e as unknown as React.MouseEvent); } }}
          className={cn(
            "inline-flex items-center justify-center flex-shrink-0 overflow-hidden",
            "w-0 opacity-0 pointer-events-none",
            "transition-[width,opacity] duration-200 ease-out",
            "group-hover:w-4 group-hover:ml-1 group-hover:opacity-70 group-hover:pointer-events-auto",
            "hover:opacity-100"
          )}
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

  if (interaction === "entry") {
    return (
      <span className={baseStyles} style={color ? { backgroundColor: color } : undefined}>
        {content}
      </span>
    );
  }

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
