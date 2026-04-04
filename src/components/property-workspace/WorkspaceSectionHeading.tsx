import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkspaceSectionHeading({
  children,
  className,
  action,
}: {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2 mb-2", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">{children}</h3>
      {action}
    </div>
  );
}
