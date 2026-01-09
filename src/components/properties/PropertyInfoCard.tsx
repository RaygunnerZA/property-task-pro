import { LucideIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropertyInfoCardProps {
  title: string;
  icon: LucideIcon;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  color?: string;
}

/**
 * PropertyInfoCard - Reusable card component for property info sections
 * 
 * Visuals:
 * - Collapsed: E1 Shadow (Lifted), Icon is Primary Teal
 * - Expanded: Engraved Shadow (Inset/Pressed), Icon is Darker
 * - Large Icon (48px) + Title
 * - Smooth height transition for content
 */
export function PropertyInfoCard({
  title,
  icon: Icon,
  isExpanded,
  onToggle,
  children,
  color,
}: PropertyInfoCardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl p-6 transition-all duration-200 cursor-pointer",
        isExpanded ? "shadow-engraved" : "shadow-e1"
      )}
      onClick={onToggle}
    >
      {/* Header: Icon + Title + Chevron */}
      <div className="flex items-center gap-4">
        {/* Large Icon */}
        <div
          className={cn(
            "flex items-center justify-center rounded-lg transition-all duration-200 bg-card",
            isExpanded
              ? "shadow-engraved"
              : "shadow-e1"
          )}
          style={{
            width: "48px",
            height: "48px",
          }}
        >
          <Icon
            className={cn(
              "h-6 w-6 transition-colors duration-200",
              isExpanded
                ? color || "text-primary-deep"
                : "text-primary"
            )}
          />
        </div>

        {/* Title */}
        <h3 className="flex-1 text-base font-semibold text-foreground">
          {title}
        </h3>

        {/* Chevron Indicator */}
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </div>

      {/* Content: Expandable */}
      {isExpanded && children && (
        <div
          className="mt-6 overflow-hidden"
          style={{
            animation: "accordion-down 0.2s ease-out",
          }}
        >
          <div className="pt-4 border-t border-border/50">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

