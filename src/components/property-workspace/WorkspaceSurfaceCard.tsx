import { ReactNode } from "react";

import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { cn } from "@/lib/utils";

export interface WorkspaceSurfaceCardProps {
  children: ReactNode;
  className?: string;
  /** Optional title for the card header area */
  title?: string;
  /** Sits immediately to the right of the title (icons, status). */
  titleAccessory?: ReactNode;
  description?: string;
}

/**
 * Neomorphic surface used across property workspaces — matches card grammar (shadow-e1, soft radius).
 */
export function WorkspaceSurfaceCard({
  children,
  className,
  title,
  titleAccessory,
  description,
}: WorkspaceSurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-card/60 shadow-e1",
        "transition-shadow duration-200 hover:shadow-md",
        className
      )}
    >
      {(title || description) && (
        <div className="px-4 pt-4 pb-2">
          {title && (
            <div className="flex items-center gap-2">
              <PanelSectionTitle as="h3" className="mb-0">
                {title}
              </PanelSectionTitle>
              {titleAccessory}
            </div>
          )}
          {description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          )}
        </div>
      )}
      <div className={cn(title || description ? "px-4 pt-1 pb-4" : "p-4")}>{children}</div>
    </div>
  );
}
