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
  ...rest
}: NeomorphicButtonProps) {
  const baseStyles =
    "w-full px-6 py-3 rounded-sharp font-medium transition-[transform,box-shadow,background-color,color] duration-150 ease-out relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  const variantStyles = {
    primary: disabled
      ? "bg-primary/70 text-primary-foreground/70 shadow-inset cursor-not-allowed"
      : "bg-primary text-primary-foreground shadow-primary-btn hover:brightness-105 active:shadow-btn-pressed",
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

  return (
    <button
      className={cn(baseStyles, variantStyles[variant], className)}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
