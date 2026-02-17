/**
 * Filter Chip - Frozen chip system for FilterBar and DocumentCategoryChips only.
 *
 * DO NOT modify: structure, animation, shadow, removal logic, or role.
 * This component is isolated from the Semantic Chip System.
 */

import React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface FilterChipProps {
  label: string;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  icon?: React.ReactNode;
  color?: string;
  className?: string;
}

export function FilterChip({
  label,
  selected = false,
  onSelect,
  onRemove,
  icon,
  color,
  className,
}: FilterChipProps) {
  const handleClick = () => {
    if (onSelect) onSelect();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) onRemove();
  };

  const isIconOnly =
    !label ||
    className?.includes("w-[24px]") ||
    className?.includes("w-[35px]") ||
    className?.includes("px-0");

  const isFilterBarChip =
    className?.includes("h-[28px]") ||
    className?.includes("h-[24px]") ||
    className?.includes("h-[35px]") ||
    className?.includes("w-[24px]") ||
    className?.includes("w-[35px]");

  const chipHeight = "h-[28px]";
  const textSize = "text-[11px]";
  const iconSize = isFilterBarChip ? "h-[14px] w-[14px]" : undefined;

  const activeBgColor =
    selected && color ? { backgroundColor: color } : undefined;

  return (
    <button
      type="button"
      onClick={handleClick}
      style={activeBgColor}
      className={cn(
        "inline-flex items-center",
        isIconOnly ? "justify-center gap-0" : "gap-1.5",
        "px-2 py-1",
        chipHeight,
        "rounded-[8px]",
        "font-mono uppercase tracking-wide",
        textSize,
        "transition-all duration-150 cursor-pointer select-none",
        "bg-background text-muted-foreground",
        "shadow-[1px_2px_2px_0px_rgba(0,0,0,0.15),-2px_-2px_2px_0px_rgba(255,255,255,0.7)]",
        selected && color
          ? "text-white border-transparent"
          : selected
            ? "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
            : "hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
        "relative",
        className
      )}
    >
      {icon && (
        <span className="flex-shrink-0">
          {React.isValidElement(icon) && iconSize
            ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
                className: cn(iconSize, (icon as React.ReactElement<{ className?: string }>).props?.className),
              })
            : icon}
        </span>
      )}
      <span className="truncate max-w-[120px] flex-1">{label}</span>
      {onRemove && selected && (
        <button
          type="button"
          onClick={handleRemove}
          className="ml-0.5 text-current opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </button>
  );
}
