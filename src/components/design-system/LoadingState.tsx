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
 * Provides consistent loading UI across all pages
 * 
 * @example
 * ```tsx
 * <LoadingState message="Loading properties..." />
 * ```
 */
export function LoadingState({
  message = "Loading...",
  className,
  size = "md"
}: LoadingStateProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  };

  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 className={cn("animate-spin text-muted-foreground", sizeClasses[size])} />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}

