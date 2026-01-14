/**
 * InstructionBlock - Calm guidance when entity needs to be added
 * 
 * Design Constraints:
 * - Calm, helpful tone
 * - No warnings or modals
 * - Disappears once resolved
 * - Section-specific buttons and helper text
 */

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InstructionBlockProps {
  message: string;
  buttons: Array<{
    label: string;
    helperText: string;
    onClick: () => void;
  }>;
  onDismiss?: () => void;
  className?: string;
}

export function InstructionBlock({
  message,
  buttons,
  onDismiss,
  className
}: InstructionBlockProps) {
  return (
    <div
      className={cn(
        "rounded-[8px] p-4 bg-card/50 border border-concrete/30 shadow-e1",
        "mb-4 space-y-3",
        className
      )}
    >
      {/* Header with dismiss button */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-foreground leading-relaxed flex-1">
          {message}
        </p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 p-1 rounded-[4px] hover:bg-background/50 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        {buttons.map((button, idx) => (
          <button
            key={idx}
            type="button"
            onClick={button.onClick}
            className="w-full text-left px-3 py-2 rounded-[5px] bg-background hover:bg-card transition-colors shadow-sm border border-concrete/20 group"
          >
            <div className="font-medium text-sm text-foreground mb-0.5">
              {button.label}
            </div>
            <div className="text-xs text-muted-foreground">
              {button.helperText}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}