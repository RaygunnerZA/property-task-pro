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
    `
  };
.filla-button {
  background: #EB6834; /* Coral */
  color: white;
  padding: 16px 32px;
  border-radius: 16px;
  font-weight: 600;
  border: none;

  /* Neomorphic highlight + grounded shadow */
  box-shadow:
    /* Deep grounded shadow below */
    0 8px 14px rgba(0,0,0,0.35),

    /* Soft base shadow */
    0 3px 6px rgba(0,0,0,0.18),

    /* Gentle top-left highlight */
    -3px -3px 6px rgba(255,255,255,0.22);

  transition: all 0.15s ease-out;
}

.filla-button:hover {
  box-shadow:
    0 10px 18px rgba(0,0,0,0.38),
    0 4px 8px rgba(0,0,0,0.20),
    -3px -3px 6px rgba(255,255,255,0.26);
  transform: translateY(-1px);
}

.filla-button:active {
  box-shadow:
    inset 0 2px 3px rgba(0,0,0,0.25),
    inset -1px -1px 2px rgba(255,255,255,0.25);
  transform: translateY(1px);
}

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
