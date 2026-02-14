/**
 * StatusGroupedSection - Framework V2 compliance section
 * Groups items by severity with coloured header strip
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SeverityLevel = "critical" | "warning" | "neutral";

const SEVERITY_BANDS: Record<SeverityLevel, string> = {
  critical: "bg-destructive/25",
  warning: "bg-warning/25",
  neutral: "bg-muted-foreground/20",
};

interface StatusGroupedSectionProps {
  severity: SeverityLevel;
  title: string;
  items: ReactNode[];
  emptyMessage?: string;
  className?: string;
}

export function StatusGroupedSection({
  severity,
  title,
  items,
  emptyMessage = "No items",
  className,
}: StatusGroupedSectionProps) {
  return (
    <div
      className={cn(
        "rounded-[8px] overflow-hidden shadow-e1",
        "transition-all duration-150 ease-out",
        "hover:shadow-e2",
        className
      )}
    >
      {/* 36px coloured header strip */}
      <div
        className={cn(
          "h-9 flex items-center px-4 font-semibold text-sm text-foreground",
          SEVERITY_BANDS[severity]
        )}
      >
        {title}
      </div>
      {/* Body - 16px padding, 16px gap between items */}
      <div className="p-4 bg-card space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="min-h-[80px]">
              {item}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
