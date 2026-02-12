/**
 * TintedSectionCard - Framework V2 section card
 * 36px tinted header band, expandable, used for Document categories, Compliance categories, Asset type sections
 */
import { ReactNode, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type TintedSectionColor =
  | "teal"
  | "mint"
  | "orange"
  | "red"
  | "amber"
  | "slate";

const COLOR_BANDS: Record<TintedSectionColor, string> = {
  teal: "bg-primary/25",
  mint: "bg-success/25",
  orange: "bg-accent/25",
  red: "bg-destructive/25",
  amber: "bg-warning/25",
  slate: "bg-muted-foreground/20",
};

interface TintedSectionCardProps {
  title: string;
  color: TintedSectionColor;
  count?: number;
  children: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export function TintedSectionCard({
  title,
  color,
  count,
  children,
  collapsible = false,
  defaultExpanded = true,
  className,
}: TintedSectionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={cn(
        "rounded-[8px] overflow-hidden shadow-e1",
        "transition-all duration-150 ease-out",
        "hover:shadow-e2 hover:-translate-y-0.5",
        className
      )}
    >
      {/* 36px tinted header band */}
      <button
        type="button"
        className={cn(
          "w-full h-9 flex-shrink-0 flex items-center justify-between gap-2 px-4",
          COLOR_BANDS[color],
          "text-foreground font-semibold text-sm",
          collapsible && "cursor-pointer hover:opacity-90"
        )}
        onClick={collapsible ? () => setExpanded((e) => !e) : undefined}
      >
        <span className="flex items-center gap-2">
          {collapsible && (
            <span className="flex-shrink-0">
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
          )}
          <span>{title}</span>
          {count != null && (
            <span className="text-xs font-medium bg-background/50 px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </span>
      </button>
      {/* Body - neutral surface, 16px padding */}
      {(!collapsible || expanded) && (
        <div className="p-4 bg-card">{children}</div>
      )}
    </div>
  );
}
