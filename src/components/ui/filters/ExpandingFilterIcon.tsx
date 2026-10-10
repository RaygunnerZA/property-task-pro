import React from "react";
import { cn } from "@/lib/utils";

const EXPAND_EASE = "duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]";

type ExpandingFilterIconProps = {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  /** Idle icon color. Selected status chips pass white. */
  iconClassName?: string;
  selectedSurfaceClassName?: string;
  selectedIconClassName?: string;
  selectedLabelClassName?: string;
};

/**
 * 28px colourful filter icon. Hover or focus eases the name out to the right.
 * Same footprint as FILTER / SORT.
 */
export function ExpandingFilterIcon({
  label,
  selected = false,
  onClick,
  icon,
  iconClassName,
  selectedSurfaceClassName,
  selectedIconClassName,
  selectedLabelClassName,
}: ExpandingFilterIconProps) {
  const painted = React.isValidElement(icon)
    ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
        className: cn(
          "h-[14px] w-[14px]",
          selected ? selectedIconClassName ?? iconClassName : iconClassName,
          (icon.props as { className?: string }).className
        ),
      })
    : icon;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "group/status inline-flex h-[28px] min-w-[28px] items-center overflow-hidden rounded-[8px]",
        "select-none cursor-pointer",
        "transition-[padding,gap,background-color,box-shadow]",
        EXPAND_EASE,
        "gap-0 pr-0",
        "hover:gap-1.5 hover:pr-2.5",
        "focus-visible:gap-1.5 focus-visible:pr-2.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        selected
          ? cn(selectedSurfaceClassName, "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.18)]")
          : cn(
              "bg-background",
              "shadow-[1px_2px_2px_0px_rgba(0,0,0,0.12),-1px_-1px_2px_0px_rgba(255,255,255,0.85)]",
              "hover:bg-card"
            )
      )}
    >
      <span className="inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center">
        {painted}
      </span>
      <span
        className={cn(
          "whitespace-nowrap overflow-hidden font-mono text-2xs uppercase tracking-wide",
          "max-w-0 opacity-0",
          "transition-[max-width,opacity]",
          EXPAND_EASE,
          "group-hover/status:max-w-[8rem] group-hover/status:opacity-100",
          "group-focus-visible/status:max-w-[8rem] group-focus-visible/status:opacity-100",
          selected && selectedLabelClassName ? selectedLabelClassName : "text-foreground"
        )}
      >
        {label}
      </span>
    </button>
  );
}
