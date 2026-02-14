/**
 * FrameworkEmptyState - V2 compact empty state
 * 280px max height, centered, icon + one-line + primary CTA
 */
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FrameworkEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function FrameworkEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: FrameworkEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-[8px] bg-card shadow-e1 p-6 max-h-[280px] flex flex-col items-center justify-center text-center",
        className
      )}
    >
      <Icon className="h-10 w-10 text-muted-foreground mb-3" />
      <h3 className="font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="btn-accent-vibrant">
          {action.label}
        </Button>
      )}
    </div>
  );
}
