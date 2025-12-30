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
            ? "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
            : "text-muted-foreground hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
        )}
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
            ? "bg-card text-foreground shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
            : "text-muted-foreground hover:bg-card hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15),inset_-1px_-1px_2px_rgba(255,255,255,0.3)]"
        )}
        aria-label="Vertical view"
      >
        <Columns2 className="h-4 w-4" />
      </button>
    </div>
  );
}

