import { AlertTriangle, Minus, ArrowDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { TaskPriority } from "@/types/database";
import { cn } from "@/lib/utils";

interface PriorityTabProps {
  priority: TaskPriority;
  onPriorityChange: (priority: TaskPriority) => void;
}

const priorities: { value: TaskPriority; label: string; icon: React.ReactNode; color: string; bgClass: string }[] = [
  { 
    value: "low", 
    label: "LOW", 
    icon: <ArrowDown className="h-4 w-4" />,
    color: "text-foreground",
    bgClass: "bg-card border-border"
  },
  { 
    value: "medium", 
    label: "MEDIUM", 
    icon: <Minus className="h-4 w-4" />,
    color: "text-primary",
    bgClass: "bg-primary/10 border-primary/30"
  },
  { 
    value: "high", 
    label: "HIGH", 
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-warning",
    bgClass: "bg-warning/10 border-warning/30"
  },
  { 
    value: "urgent", 
    label: "URGENT", 
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-accent",
    bgClass: "bg-accent/10 border-accent/30"
  },
];

export function PriorityTab({ priority, onPriorityChange }: PriorityTabProps) {
  return (
    <div className="space-y-4">
      <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <AlertTriangle className="h-3.5 w-3.5" />
        Priority Level
      </Label>
      
      <div className="flex flex-wrap gap-2">
        {priorities.map(({ value, label, icon, color }) => {
          const isSelected = priority === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onPriorityChange(value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5",
                "rounded-[5px] border",
                "font-mono text-xs uppercase tracking-wide",
                "transition-colors cursor-pointer select-none",
                isSelected
                  ? cn("border-transparent", color, value === "low" ? "bg-muted" : value === "medium" ? "bg-primary text-primary-foreground" : value === "high" ? "bg-warning text-warning-foreground" : "bg-accent text-accent-foreground")
                  : "bg-white border-border text-muted-foreground hover:border-primary hover:text-foreground"
              )}
            >
              <span className="flex-shrink-0">{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-3 rounded-[5px] bg-muted/50 shadow-engraved">
        <p className="text-xs text-muted-foreground">
          {priority === "low" && "Low priority tasks appear at the bottom of lists and calendars."}
          {priority === "medium" && "Medium priority tasks appear in standard order."}
          {priority === "high" && "High priority tasks are flagged for attention."}
          {priority === "urgent" && "Urgent tasks are highlighted and appear at the top of lists."}
        </p>
      </div>
    </div>
  );
}
