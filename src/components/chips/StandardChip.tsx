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
  pending?: boolean; // Dim text 50% for pending invitations
  className?: string;
}

/**
 * StandardChip - Unified chip component with consistent styling
 * - Height: 35px (h-[35px] with py-1.5 px-3)
 * - Border-radius: 8px
 * - Font: JetBrains Mono, uppercase, text-[13px]
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
  pending = false,
  className,
}: StandardChipProps) {
  const handleClick = () => {
    if (onSelect) onSelect();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) onRemove();
  };

  // Ghost variant styling (only if not selected)
  // When selected, ghost chips should show as normal selected chips
  if (ghost && !selected) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1.5",
          "rounded-[8px] border border-dashed",
          "font-mono text-[12px] uppercase",
          "transition-colors cursor-pointer select-none",
          "border-muted-foreground/30 text-muted-foreground/50",
          "hover:border-primary/50 hover:text-muted-foreground",
          className
        )}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span className="truncate max-w-[120px] text-[12px] leading-[15px]">{label}</span>
      </button>
    );
  }

  // Active/selected styling with filter chip style
  const activeStyles = selected && color
    ? { backgroundColor: color, borderColor: color }
    : undefined;

  return (
      <button
        type="button"
        onClick={handleClick}
        style={activeStyles}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1.5 rounded-[8px] h-[29px]",
          "font-mono text-[12px] uppercase transition-all",
          "select-none cursor-pointer",
          pending && "opacity-50", // Dim text 50% for pending invitations
          selected
            ? // Active: Pressed neumorphic with off-white fill (or custom color)
              color
                ? "text-white border-transparent shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
                : "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
            : // Inactive: Transparent with neumorphic shadows
              "bg-background text-muted-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
          className
        )}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span className="truncate max-w-[120px] text-[12px] leading-[15px]">{label}</span>
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
