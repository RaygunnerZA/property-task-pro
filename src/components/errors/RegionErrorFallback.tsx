import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RegionErrorFallbackProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Scoped recovery UI for ErrorBoundary wrappers (dashboard columns, routes).
 * Neomorphic per @Docs/04_UI_System — soft depth, no harsh borders.
 */
export function RegionErrorFallback({
  title,
  description = "This section hit an unexpected error. You can try again or reload the page.",
  onRetry,
  className,
}: RegionErrorFallbackProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-5 shadow-e1 bg-card text-foreground flex flex-col gap-3 min-h-[120px] justify-center",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm bg-destructive/10">
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {onRetry ? (
          <Button type="button" size="sm" variant="default" className="shadow-primary-btn" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" className="shadow-e1" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  );
}
