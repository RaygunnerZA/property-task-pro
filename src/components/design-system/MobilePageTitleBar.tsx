import type { ReactNode } from "react";
import {
  workbenchPageTitleClassName,
  workbenchSectionSubtitleClassName,
} from "@/lib/workbenchSectionTitle";
import { cn } from "@/lib/utils";

export type MobilePageTitleBarProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/**
 * Title row for StandardPage routes on mobile — sits below MobileAppHeader when
 * the desktop PageHeader gradient strip is hidden.
 */
export function MobilePageTitleBar({
  title,
  subtitle,
  icon,
  action,
  className,
}: MobilePageTitleBarProps) {
  return (
    <div
      className={cn(
        "border-b border-border/20 bg-background/90 px-gutter-page py-3 lg:hidden",
        className
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon ? (
            <span className="icon-primary mt-1 shrink-0 [&_svg]:h-6 [&_svg]:w-6">{icon}</span>
          ) : null}
          <div className="min-w-0">
            <h1 className={workbenchPageTitleClassName}>{title}</h1>
            {subtitle ? (
              <p className={cn("mt-0.5", workbenchSectionSubtitleClassName)}>{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
