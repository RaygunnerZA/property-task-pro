import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type IconButtonRole = 'filter-toggle' | 'action' | 'navigation';

export interface IconButtonProps {
  role: IconButtonRole;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean; // Only for filter-toggle
  size?: 24 | 35 | 40;
  className?: string;
  tooltip?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * IconButton - Unified icon button with role-based behavior
 * 
 * Rules:
 * - Same depth as chips (Level 2: Tactile)
 * - Pressed state (Level 3) on hover/active - momentary only
 * - Never use depth to indicate meaning
 */
export function IconButton({
  role,
  icon,
  onClick,
  active = false,
  size = 24,
  className,
  tooltip,
  disabled = false,
  'aria-label': ariaLabel,
}: IconButtonProps) {
  const sizeClass = size === 24 ? "h-6 w-6" : size === 35 ? "h-[28px] w-[28px]" : "h-10 w-10";
  
  const baseStyles = cn(
    sizeClass,
    "rounded-[5px] flex items-center justify-center gap-0",
    "transition-all duration-150",
    "bg-background",
    "shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)]",
    disabled
      ? "opacity-50 cursor-not-allowed"
      : "cursor-pointer hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)] hover:bg-card",
    active && "bg-card shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]",
    className
  );

  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={baseStyles}
      aria-label={ariaLabel}
    >
      {icon}
    </button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}
