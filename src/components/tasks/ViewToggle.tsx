import { Rows3, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  view: 'horizontal' | 'vertical';
  onViewChange: (view: 'horizontal' | 'vertical') => void;
  className?: string;
}

export function ViewToggle({ view, onViewChange, className }: ViewToggleProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        onClick={() => onViewChange('horizontal')}
        className={cn(
          "p-1.5 rounded-[5px] transition-all",
          "flex items-center justify-center",
          view === 'horizontal'
            ? "text-foreground shadow-none"
            : "text-muted-foreground hover:bg-card"
        )}
        style={view === 'horizontal' ? {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          boxShadow: 'none'
        } : undefined}
        aria-label="Horizontal view"
      >
        <Rows3 className="h-4 w-4" />
      </button>
      <button
        onClick={() => onViewChange('vertical')}
        className={cn(
          "p-1.5 rounded-[5px] transition-all",
          "flex items-center justify-center",
          view === 'vertical'
            ? "text-foreground shadow-none"
            : "text-muted-foreground hover:bg-card"
        )}
        style={view === 'vertical' ? {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          boxShadow: 'none'
        } : undefined}
        aria-label="Vertical view"
      >
        <Columns2 className="h-4 w-4" />
      </button>
    </div>
  );
}

