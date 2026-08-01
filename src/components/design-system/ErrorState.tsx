import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  message: string;
  className?: string;
  onRetry?: () => void;
}

/**
 * ErrorState - Standardized error state component
 * 
 * Provides consistent error UI across all pages
 * 
 * @example
 * ```tsx
 * <ErrorState 
 *   message="Failed to load properties"
 *   onRetry={() => refresh()}
 * />
 * ```
 */
export function ErrorState({
  message,
  className,
  onRetry
}: ErrorStateProps) {
  return (
    <Card className={className} role="alert">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 shadow-engraved">
            <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-destructive font-medium">Error</p>
            <p className="text-sm text-muted-foreground mt-1 break-words">{message}</p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="rounded-sharp px-2 py-1 text-sm font-medium text-primary-deep transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              Retry
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

