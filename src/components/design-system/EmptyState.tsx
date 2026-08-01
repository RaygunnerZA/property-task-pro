import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import { FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Optional icon — defaults to FileQuestion when omitted */
  icon?: LucideIcon;
  title: string;
  /** Primary body copy. Also accepts `subtitle` as an alias. */
  description?: string;
  /** Alias for description — accepted so callers don't need migration */
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

/**
 * EmptyState - Standardized empty state component
 * 
 * Provides consistent empty state UI across all pages
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   icon={Home}
 *   title="No properties yet"
 *   description="Add your first property to get started"
 *   action={{
 *     label: "Add Property",
 *     onClick: () => setShowAdd(true),
 *     icon: Plus
 *   }}
 * />
 * ```
 */
export function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  subtitle,
  action,
  className
}: EmptyStateProps) {
  const body = description ?? subtitle;
  return (
    <Card className={cn("p-8 text-center max-w-md mx-auto", className)}>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-input shadow-engraved">
        <Icon className="h-7 w-7 text-muted-foreground icon-shadow-neu-pressed" aria-hidden="true" />
      </div>
      <h3 className="font-semibold text-lg mb-2 [text-wrap:balance]">{title}</h3>
      {body && <p className="text-muted-foreground text-sm mb-4 [text-wrap:pretty]">{body}</p>}
      {action && (
        <Button onClick={action.onClick}>
          {action.icon && <action.icon className="h-4 w-4 mr-2" />}
          {action.label}
        </Button>
      )}
    </Card>
  );
}

