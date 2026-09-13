import type { ReactNode } from "react";
import { WorkbenchSectionHero } from "@/components/workbench/WorkbenchSectionHero";
import {
  workbenchPageTitleClassName,
  workbenchSectionSubtitleClassName,
} from "@/lib/workbenchSectionTitle";
import { cn } from "@/lib/utils";

export type PageContentTitleProps = {
  title: string;
  subtitle?: string;
  /** Small Lucide / SVG icon (legacy). Prefer {@link illustrationSrc} for workbench heroes. */
  icon?: ReactNode;
  /** Large paper-craft illustration to the left of the title (e.g. `/centre-workbench/tasks.png`). */
  illustrationSrc?: string;
  action?: ReactNode;
  /** Optional control before the icon (e.g. Back). */
  leading?: ReactNode;
  className?: string;
};

/**
 * In-content page H1 for StandardPage / property workspace routes —
 * titles sit in the left (context) column, not the gradient header chrome.
 */
export function PageContentTitle({
  title,
  subtitle,
  icon,
  illustrationSrc,
  action,
  leading,
  className,
}: PageContentTitleProps) {
  if (illustrationSrc) {
    return (
      <header className={cn("mb-0 min-w-0", className)}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <WorkbenchSectionHero
            title={title}
            description={subtitle}
            illustrationSrc={illustrationSrc}
            className="min-w-0 flex-1"
          />
          {action ? <div className="shrink-0 pt-3">{action}</div> : null}
        </div>
      </header>
    );
  }

  return (
    <header className={cn("mb-5 min-w-0 border-b border-border/15 pb-4", className)}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
          {icon ? (
            <span className="icon-primary mt-1 shrink-0 [&_svg]:h-6 [&_svg]:w-6">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className={workbenchPageTitleClassName}>{title}</h1>
            {subtitle ? (
              <p className={cn("mt-1", workbenchSectionSubtitleClassName)}>{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
