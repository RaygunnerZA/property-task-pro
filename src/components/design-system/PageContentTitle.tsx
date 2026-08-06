import type { ReactNode } from "react";
import { workbenchSectionTitleClassName } from "@/lib/workbenchSectionTitle";
import { cn } from "@/lib/utils";

export type PageContentTitleProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** Optional control before the icon (e.g. Back). */
  leading?: ReactNode;
  className?: string;
};

/**
 * In-content page title for StandardPage routes — uses workbench section title styles
 * so titles sit in the main column instead of the gradient header chrome.
 */
export function PageContentTitle({
  title,
  subtitle,
  icon,
  action,
  leading,
  className,
}: PageContentTitleProps) {
  return (
    <header className={cn("mb-5 min-w-0 border-b border-border/15 pb-4", className)}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
          {icon ? (
            <span className="icon-primary mt-0.5 shrink-0 [&_svg]:h-6 [&_svg]:w-6">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className={workbenchSectionTitleClassName}>{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
