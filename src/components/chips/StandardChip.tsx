import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface StandardChipProps {
  label: string;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  icon?: React.ReactNode;
  color?: string;
  ghost?: boolean;
  className?: string;
}

/**
 * StandardChip - Unified chip component with consistent styling
 * - Height: 32px (py-1.5 px-3)
 * - Border-radius: 5px
 * - Font: JetBrains Mono, uppercase, text-xs
 * - Inactive: white bg, light grey text
 * - Active: colored bg (primary or custom), white text
 * - Ghost: dashed border, very light grey text
 */
export function StandardChip({
  label,
  selected = false,
  onSelect,
  onRemove,
  icon,
  color,
  ghost = false,
  className,
}: StandardChipProps) {
  const handleClick = () => {
    if (onSelect) onSelect();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) onRemove();
  };

  // Ghost variant styling
  if (ghost) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5",
          "rounded-[5px] border border-dashed",
          "font-mono text-xs uppercase tracking-wide",
          "transition-colors cursor-pointer select-none",
          "border-muted-foreground/30 text-muted-foreground/50",
          "hover:border-primary/50 hover:text-muted-foreground",
          className
        )}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span className="truncate max-w-[120px]">{label}</span>
      </button>
    );
  }

  // Active/selected styling
  const activeStyles = selected
    ? color
      ? { backgroundColor: color, borderColor: color }
      : undefined
    : undefined;

  return (
    <button
      type="button"
      onClick={handleClick}
      style={activeStyles}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5",
        "rounded-[5px] border",
        "font-mono text-xs uppercase tracking-wide",
        "transition-colors cursor-pointer select-none",
        selected
          ? color
            ? "text-white border-transparent"
            : "bg-primary text-primary-foreground border-primary"
          : "bg-white border-border text-muted-foreground hover:border-primary hover:text-foreground",
        className
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="truncate max-w-[120px]">{label}</span>
      {selected && onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className="ml-0.5 text-current opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </button>
  );
}
