import { ButtonHTMLAttributes, ReactNode } from "react";

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
  const baseStyles = "w-full px-6 py-3 rounded-xl font-medium transition-all duration-150 ease-out";

  const variantStyles = {
    primary: `
      bg-accent text-accent-foreground
      hover:brightness-110 active:brightness-95
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
    secondary: `
      bg-[#F6F4F2] text-[#1C1C1C]
      hover:text-accent
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
    ghost: `
      bg-transparent text-[#6D7480]
      hover:text-[#1C1C1C]
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
  };

  const variantShadows = {
    primary: disabled
      ? `
      /* Soft, flattened disabled surface */
      inset 1px 1px 2px rgba(0,0,0,0.12),
      inset -1px -1px 2px rgba(255,255,255,0.35)
    `
      : `
      /* Grounded shadow */
      0 8px 14px rgba(0,0,0,0.28),
      0 3px 6px rgba(0,0,0,0.16),

      /* Soft highlight top-left */
      -3px -3px 6px rgba(255,255,255,0.22)
    `,

    secondary: disabled
      ? `
      /* Inset disabled state */
      inset 1px 1px 3px rgba(0,0,0,0.15),
      inset -1px -1px 3px rgba(255,255,255,0.28)
    `
      : `
      /* Subtle neomorphic card-like treatment */
      -2px -2px 4px rgba(255,255,255,0.55),
      2px 2px 4px rgba(0,0,0,0.1)
    `,

    ghost: "none",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
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
