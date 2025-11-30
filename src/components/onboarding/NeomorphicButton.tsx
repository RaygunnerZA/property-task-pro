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
      bg-[#FF6B6B] text-white
      hover:bg-[#FF5252] active:bg-[#FF4040]
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
    secondary: `
      bg-[#F6F4F2] text-[#1C1C1C]
      hover:text-[#FF6B6B]
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
    ghost: `
      bg-transparent text-[#6D7480]
      hover:text-[#1C1C1C]
      disabled:opacity-50 disabled:cursor-not-allowed
    `
  };

  const variantShadows = {
    primary: disabled 
      ? "2px 2px 6px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.5)"
      : "3px 3px 8px rgba(255,107,107,0.3), -2px -2px 6px rgba(255,255,255,0.7)",
    secondary: disabled
      ? "inset 2px 2px 4px rgba(0,0,0,0.08), inset -2px -2px 4px rgba(255,255,255,0.7)"
      : "inset 1px 1px 3px rgba(0,0,0,0.08), inset -1px -1px 3px rgba(255,255,255,0.7), 2px 2px 6px rgba(0,0,0,0.05)",
    ghost: "none"
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={{
        boxShadow: variantShadows[variant]
      }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
