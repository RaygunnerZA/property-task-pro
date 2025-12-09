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
      <Label className="text-sm font-medium">Set Priority Level</Label>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {priorities.map(({ value, label, icon, color, bgClass }) => (
          <button
            key={value}
            type="button"
            onClick={() => onPriorityChange(value)}
            className={cn(
              "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
              "hover:scale-105 active:scale-95",
              priority === value 
                ? cn(bgClass, "shadow-e2 border-current", color)
                : "bg-card border-transparent shadow-e1 hover:shadow-e2"
            )}
          >
            <div className={cn(
              "p-2 rounded-full",
              priority === value ? bgClass : "bg-muted"
            )}>
              <span className={priority === value ? color : "text-muted-foreground"}>
                {icon}
              </span>
            </div>
            <span className={cn(
              "font-mono text-xs uppercase tracking-wider",
              priority === value ? color : "text-muted-foreground"
            )}>
              {label}
            </span>
          </button>
        ))}
      </div>

      <div className="p-3 rounded-lg bg-muted/50 shadow-engraved">
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
