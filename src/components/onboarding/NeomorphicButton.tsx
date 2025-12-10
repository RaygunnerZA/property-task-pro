import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface NeomorphicButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  children: ReactNode;
}

export function NeomorphicButton({
  variant = "primary",
  children,
  className = "",
  disabled,
  ...props
}: NeomorphicButtonProps) {
  const baseStyles = "w-full px-6 py-3 rounded-[5px] font-medium transition-all duration-150 ease-out relative";

  const variantStyles = {
    primary: cn(
      "bg-primary text-primary-foreground",
      !disabled && "neo-surface",
      "disabled:opacity-50 disabled:cursor-not-allowed"
    ),
    secondary: cn(
      "bg-transparent text-foreground",
      !disabled && "neo-surface-light",
      "disabled:opacity-50 disabled:cursor-not-allowed"
    ),
    ghost: cn(
      "bg-transparent text-muted-foreground",
      "hover:text-foreground",
      "disabled:opacity-50 disabled:cursor-not-allowed"
    ),
  };

  const variantShadows = {
    primary: disabled
      ? `inset 1px 1px 2px rgba(0,0,0,0.12), inset -1px -1px 2px rgba(255,255,255,0.35)`
      : `3px 5px 5px 2px rgba(0,0,0,0.13),
         -3px -3px 5px 0px rgba(255,255,255,0.48),
         inset 1px 1px 2px 0px rgba(255,255,255,0.5),
         inset -1px -2px 2px 0px rgba(0,0,0,0.27)`,

    secondary: disabled
      ? `inset 1px 1px 3px rgba(0,0,0,0.15), inset -1px -1px 3px rgba(255,255,255,0.28)`
      : `-2px -2px 4px rgba(255,255,255,0.55), 2px 2px 4px rgba(0,0,0,0.1)`,

    ghost: "none",
  };

  return (
    <button
      className={cn(baseStyles, variantStyles[variant], className)}
      style={{
        boxShadow: variantShadows[variant],
      }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
