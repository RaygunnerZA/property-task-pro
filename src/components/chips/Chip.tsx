import { cn } from "@/lib/utils";
import { X, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// Import filla-ai icon
import fillaAISrc from "@/assets/filla-ai.svg";

export type ChipRole = 'filter' | 'fact' | 'suggestion' | 'status' | 'verb';

export interface ChipProps {
  role: ChipRole; // REQUIRED - no default
  label: string;
  selected?: boolean; // Only for filter role
  onSelect?: () => void; // Only for filter role
  onRemove?: () => void; // Only for fact role
  icon?: React.ReactNode;
  color?: string; // Only allowed for filter (property color) or status (alert color)
  className?: string;
  // Suggestion-specific
  aiGlyph?: boolean; // Shows Filla icon for suggestions
  // Animation
  animate?: boolean; // For suggestions sliding in
  // AI-pre-filled: Distinguishes AI-pre-filled fact chips from user-selected ones
  aiPreFilled?: boolean; // For fact chips: true if AI-pre-filled, false/undefined if user-selected
  // Tooltip/Description - shown on hover
  description?: string; // Optional description shown on hover (e.g., "Add person or Team", "Add Venue", etc.)
}

/**
 * Unified Chip Component - Enforces Semantic Roles
 * 
 * Behavior Contract:
 * - filter: Toggleable, removable, colorful (property colors OK), no AI glyph
 * - fact: Not toggleable, removable, neutral only, no AI glyph
 * - suggestion: Not toggleable, not removable, dotted border, AI glyph, lighter contrast
 * - status: Not toggleable, not removable, alert color only, no AI glyph
 * - verb: Not toggleable, not removable, dashed border, orange text, white bg, no shadow, clickable to resolve
 * 
 * Depth System:
 * - All chips: Same tactile depth (Level 2)
 * - Selected/active: Pressed depth (Level 3) - momentary only
 * - Never use depth to indicate meaning
 */
export function Chip({
  role,
  label,
  selected = false,
  onSelect,
  onRemove,
  icon,
  color,
  className,
  aiGlyph = false,
  animate = false,
  aiPreFilled = false,
  description,
}: ChipProps) {
  // Enforce role-based behavior contracts
  const canToggle = role === 'filter';
  const canRemove = role === 'fact' || role === 'filter';
  const canUseColor = role === 'filter' || role === 'status';
  const hasDottedBorder = role === 'suggestion' && !selected;
  const hasDashedBorder = role === 'verb';
  // No per-chip AI glyphs - only at row level
  const showAIGlyph = false;
  
  // Hover state for suggestion chips with checkmark expansion
  const [isHovered, setIsHovered] = useState(false);

  // Validation warnings (in development)
  if (process.env.NODE_ENV === 'development') {
    if (selected && !canToggle) {
      console.warn(`[Chip] ${role} chips cannot be selected/toggled`);
    }
    if (onRemove && !canRemove) {
      console.warn(`[Chip] ${role} chips cannot be removed`);
    }
    if (color && !canUseColor) {
      console.warn(`[Chip] ${role} chips cannot use color (only filter and status)`);
    }
  }

  const handleClick = () => {
    // Filter chips: toggle on/off
    if (canToggle && onSelect) {
      onSelect();
    }
    // Suggestion chips: accept on click (but not toggle)
    if (role === 'suggestion' && onSelect) {
      onSelect();
    }
    // Verb chips: resolve on click
    if (role === 'verb' && onSelect) {
      onSelect();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canRemove && onRemove) {
      onRemove();
    }
  };

  // Check if this is an icon-only chip (no label, square size)
  const isIconOnly = !label || className?.includes('w-[24px]') || className?.includes('w-[35px]') || className?.includes('px-0');
  
  // Determine height based on role and className
  // Filter chips in FilterBar should be 32px, suggestion chips should be 24px, others default to 24px
  const isFilterBarChip = role === 'filter' && (className?.includes('h-[35px]') || className?.includes('w-[35px]') || className?.includes('h-[32px]') || className?.includes('w-[32px]'));
  const chipHeight = isFilterBarChip ? "h-[32px]" : role === 'suggestion' ? "h-[24px]" : "h-[24px]";
  
  // Base styles - same for all roles (Level 2: Tactile), except verb (no shadow)
  const baseStyles = cn(
    "inline-flex items-center",
    isIconOnly ? "justify-center gap-0" : role === 'fact' ? "gap-0" : role === 'suggestion' ? "gap-0" : "gap-1.5",
    role === 'fact' ? "px-1 py-1" : role === 'suggestion' ? "px-1 py-1" : "px-2 py-1", // Fact chips and suggestion chips: 4px padding, others: 8px
    chipHeight,
    "rounded-[5px]",
    "font-mono text-[13px] uppercase tracking-normal",
    "transition-all duration-150 cursor-pointer select-none",
    role === 'verb' 
      ? "bg-white text-muted-foreground"
      : "bg-background text-muted-foreground",
    role === 'verb' || role === 'fact' || role === 'suggestion'
      ? "" // No shadow for verb chips, fact chips, and suggestion chips
      : "shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]",
    className
  );

  // Role-specific styles
  const roleStyles = {
    filter: cn(
      selected && color
        ? "text-white border-transparent"
        : selected
        ? "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
        : "hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
    ),
    fact: cn(
      // User-selected fact chips: off-white fill, no inline shadows
      !aiPreFilled && "bg-card text-foreground text-[10px]",
      // AI-pre-filled fact chips: more settled and passive (reduced contrast ~15%, no inner highlight, softer text)
      aiPreFilled && "bg-card/92 text-foreground/85 text-[10px]",
      // Fact chips are always "active" (committed data) - no hover toggle
      "cursor-default"
    ),
    suggestion: cn(
      hasDottedBorder && "border-[2px] border-dashed border-white bg-transparent",
      selected && "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] border-transparent",
      // Suggestion chips - grey text, white dotted border, 24px height
      !selected && "text-muted-foreground/70 font-medium",
      // Hover: expand width to show checkmark
      !selected && "transition-all duration-200"
    ),
    status: cn(
      color 
        ? "text-white border-transparent"
        : "bg-destructive text-destructive-foreground border-transparent"
    ),
    verb: cn(
      // Verb chips: white background, dashed border, orange text, no shadow, no removal
      "bg-white border border-dashed border-muted-foreground/30 text-[#EB6834]",
      "hover:border-[#EB6834]/50"
    ),
  };

  const activeBgColor = (selected && color && role === 'filter') || (color && role === 'status')
    ? { backgroundColor: color }
    : undefined;

  const chipContent = (
    <>
      {/* No per-chip AI glyphs - only at row level */}
      {icon && role !== 'suggestion' && role !== 'verb' && <span className="flex-shrink-0">{icon}</span>}
      <span className={cn(
        "truncate flex-1 text-[12px]",
        role === 'suggestion' && !isHovered && "max-w-[120px]", // Constrain width when not hovered
        role === 'suggestion' && isHovered && "max-w-none", // Allow expansion on hover
        role === 'suggestion' && "text-[10px] font-medium", // Suggestion chips use 10px font size and medium weight
        role === 'fact' && "text-[10px]" // Fact chips use 10px font size
      )}>{label}</span>
      {/* Checkmark for suggestion chips on hover */}
      {role === 'suggestion' && isHovered && (
        <Check className="h-3 w-3 ml-2 flex-shrink-0 text-muted-foreground/70" />
      )}
      {/* For fact chips, show X only on hover (right aligned) - smoothly expands on hover */}
      {canRemove && onRemove && role === 'fact' && (
        <button
          type="button"
          onClick={handleRemove}
          className="ml-0.5 text-current opacity-0 group-hover:opacity-70 hover:opacity-100 transition-all duration-150 flex-shrink-0 max-w-0 group-hover:max-w-4 overflow-hidden whitespace-nowrap"
        >
          <X className="h-3 w-3 flex-shrink-0" />
        </button>
      )}
      {/* For filter chips, show X always when selected */}
      {canRemove && onRemove && role === 'filter' && selected && (
        <button
          type="button"
          onClick={handleRemove}
          className="ml-0.5 text-current opacity-70 hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {hasDottedBorder && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none rounded-[5px]"
          style={{ borderRadius: '5px' }}
        >
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx="5"
            ry="5"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            opacity="0.4"
          />
        </svg>
      )}
    </>
  );

  const props = {
    type: 'button' as const,
    onClick: (canToggle || role === 'suggestion' || role === 'verb') ? handleClick : undefined,
    onMouseEnter: role === 'suggestion' ? () => setIsHovered(true) : undefined,
    onMouseLeave: role === 'suggestion' ? () => setIsHovered(false) : undefined,
    style: activeBgColor,
    className: cn(baseStyles, roleStyles[role], "relative", role === 'fact' && "group", role === 'suggestion' && "group"),
  };

  const chipButton = animate && (role === 'suggestion' || role === 'verb') ? (
    <motion.button
      {...props}
      initial={{ opacity: 0, scale: 0.8, x: -10 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {chipContent}
    </motion.button>
  ) : (
    <button {...props}>
      {chipContent}
    </button>
  );

  // Wrap with tooltip if description is provided
  if (description) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {chipButton}
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {description}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return chipButton;
}
