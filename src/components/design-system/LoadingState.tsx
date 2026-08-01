import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * LoadingState - Standardized loading state component
 *
 * Spinner sits in a debossed paper well so loading feels part of the
 * Dimensional Paper surface rather than a floating default spinner.
 *
 * @example
 * ```tsx
 * <LoadingState message="Loading properties…" />
 * ```
 */
export function LoadingState({
  message = "Loading…",
  className,
  size = "md"
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  };
  const wellClasses = {
    sm: "h-9 w-9",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  };

  return (
    <div className={cn("flex items-center justify-center py-12", className)} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className={cn("flex items-center justify-center rounded-full bg-input shadow-engraved", wellClasses[size])}>
          <Loader2 className={cn("animate-spin text-primary-deep", sizeClasses[size])} aria-hidden="true" />
        </div>
        {message && (
          <p className="text-sm text-muted-foreground tracking-wide">{message}</p>
        )}
      </div>
    </div>
  );
}
