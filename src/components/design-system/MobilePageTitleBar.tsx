import { ReactNode } from "react";
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
          {icon ? <span className="icon-primary mt-0.5 shrink-0">{icon}</span> : null}
          <div className="min-w-0">
            <h1 className="text-[20px] font-semibold leading-tight tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
