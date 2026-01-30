import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { CreateTaskModal } from "./CreateTaskModal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CreateTaskConcertinaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
  defaultPropertyId?: string;
  defaultDueDate?: string;
}

/**
 * Create Task Concertina Panel
 * 
 * A collapsible panel that shows CreateTaskModal content in the third column.
 * Can be expanded/collapsed, and when collapsed shows just a header bar.
 */
export function CreateTaskConcertina({
  open,
  onOpenChange,
  onTaskCreated,
  defaultPropertyId,
  defaultDueDate
}: CreateTaskConcertinaProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // If not open, don't render
  if (!open) return null;

  return (
    <div className="flex flex-col bg-background border-l border-border">
      {/* Header Bar - Always visible */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Create Task</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 p-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content - Collapsible */}
      {isExpanded && (
        <div className="flex-shrink-0 overflow-hidden" style={{ maxHeight: '60vh' }}>
          <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
            <CreateTaskModal
              open={true}
              onOpenChange={onOpenChange}
              onTaskCreated={(taskId) => {
                onTaskCreated?.(taskId);
                onOpenChange(false);
              }}
              defaultPropertyId={defaultPropertyId}
              defaultDueDate={defaultDueDate}
              variant="column"
            />
          </div>
        </div>
      )}
    </div>
  );
}
