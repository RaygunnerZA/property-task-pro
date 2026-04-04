import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface WorkspaceSurfaceCardProps {
  children: ReactNode;
  className?: string;
  /** Optional title for the card header area */
  title?: string;
  description?: string;
}

/**
 * Neomorphic surface used across property workspaces — matches card grammar (shadow-e1, soft radius).
 */
export function WorkspaceSurfaceCard({
  children,
  className,
  title,
  description,
}: WorkspaceSurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-[12px] bg-card/60 shadow-e1 overflow-hidden",
        "transition-shadow duration-200 hover:shadow-md",
        className
      )}
    >
      {(title || description) && (
        <div className="px-4 pt-4 pb-2">
          {title && <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>}
          {description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          )}
        </div>
      )}
      <div className={cn(title || description ? "px-4 pt-1 pb-4" : "p-4")}>{children}</div>
    </div>
  );
}
