import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface IntelligentChipProps {
  label: string;
  variant?: "default" | "success" | "warning" | "danger" | "primary" | "secondary" | "neutral";
  icon?: LucideIcon;
  size?: "sm" | "md";
  className?: string;
  onClick?: () => void;
}

/**
 * IntelligentChip - Status and meta information chip
 * Uses JetBrains Mono font for consistent typography
 * Automatically styles based on variant
 */
export function IntelligentChip({
  label,
  variant = "default",
  icon: Icon,
  size = "md",
  className,
  onClick,
}: IntelligentChipProps) {
  const variants = {
    default: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/20 text-success border-success/30",
    warning: "bg-warning/20 text-warning border-warning/30",
    danger: "bg-destructive/10 text-destructive border-destructive/20",
    primary: "bg-primary text-primary-foreground border-primary",
    secondary: "bg-secondary text-secondary-foreground border-secondary",
    neutral: "bg-muted text-muted-foreground border-border",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-[11px]",
  };

  const baseClasses = cn(
    "inline-flex items-center gap-1.5 rounded-[5px] border",
    "font-mono uppercase tracking-wide font-medium",
    "transition-colors",
    variants[variant],
    sizes[size],
    onClick && "cursor-pointer hover:opacity-80",
    className
  );

  const content = (
    <>
      {Icon && <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      <span>{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClasses}>
        {content}
      </button>
    );
  }

  return <span className={baseClasses}>{content}</span>;
}

