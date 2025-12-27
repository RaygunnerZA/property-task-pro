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
    <Card className={cn("shadow-e1", className)}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div className="flex-1">
            <p className="text-destructive font-medium">Error</p>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Retry
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

