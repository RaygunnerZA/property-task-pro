import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ChipContainerProps {
  children: ReactNode;
  className?: string;
  showGradient?: boolean;
}

/**
 * ChipContainer - Horizontal scrolling container for chips with gradient overflow
 * Similar to FilterBar's second level gradient effect
 */
export function ChipContainer({ 
  children, 
  className,
  showGradient = true 
}: ChipContainerProps) {
  return (
    <div className={cn("relative flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 min-w-0", className)}>
      {/* Right gradient - fades in when content overflows */}
      {showGradient && (
        <div
          className="absolute top-0 right-0 pointer-events-none z-10 transition-opacity duration-300"
          style={{
            top: '1px',
            width: '7px',
            height: '100%',
            opacity: 1,
            background: 'linear-gradient(270deg, rgba(0, 0, 0, 0.13) 0%, rgba(0, 0, 0, 0.05) 63%, transparent 100%)',
            borderRadius: '5px 160px 160px 0px',
          }}
        />
      )}
      <div className="flex items-center gap-2 flex-nowrap min-w-max">
        {children}
      </div>
    </div>
  );
}