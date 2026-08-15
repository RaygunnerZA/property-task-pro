import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { appUrl } from "@/lib/urls";

interface AppCtaProps {
  path?: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
}

export function AppCta({ path = "/signup", children, variant = "primary", className }: AppCtaProps) {
  const href = appUrl(path);
  if (variant === "ghost") {
    return (
      <a
        href={href}
        className={cn(
          "inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-ink/80 transition-colors hover:text-ink",
          className
        )}
      >
        {children}
      </a>
    );
  }
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-ink shadow-primary-btn transition-transform active:scale-[0.98] active:shadow-btn-pressed",
        className
      )}
    >
      {children}
    </a>
  );
}
