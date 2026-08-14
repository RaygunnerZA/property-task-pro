import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskStatusMark } from "@/components/tasks/TaskStatusMark";
import {
  getTaskStatusVisual,
  TASK_STATUS_ORDER,
  type TaskStatusVisual,
} from "@/lib/taskStatus";
import type { TaskStatus } from "@/types/database";
import { cn } from "@/lib/utils";

type TaskStatusDropdownProps = {
  status: string | null | undefined;
  disabled?: boolean;
  onStatusChange: (next: TaskStatus) => void;
  /**
   * `mark` — compact corner control on task cards.
   * `button` — labeled control used in task detail action bar.
   */
  variant?: "mark" | "button";
  className?: string;
  align?: "start" | "center" | "end";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Colourful status picker — same options as task detail Change status.
 */
export function TaskStatusDropdown({
  status,
  disabled = false,
  onStatusChange,
  variant = "mark",
  className,
  align = "start",
  open,
  onOpenChange,
}: TaskStatusDropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setIsOpen = onOpenChange ?? setUncontrolledOpen;

  const normalized = String(status ?? "open").toLowerCase() as TaskStatus;
  const currentStatus = getTaskStatusVisual(normalized);
  const CurrentStatusIcon = currentStatus.Icon;
  const statusTriggerTextClass =
    normalized === "open" ? "text-muted-foreground" : "text-white";

  return (
    <div
      className={cn(
        variant === "button" ? "w-full min-w-0 max-w-full overflow-visible" : "inline-flex",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      <DropdownMenu
        modal={false}
        open={isOpen}
        onOpenChange={(next) => {
          if (disabled && next) return;
          setIsOpen(next);
        }}
      >
        <DropdownMenuTrigger asChild>
          {variant === "mark" ? (
            <button
              type="button"
              aria-disabled={disabled || undefined}
              className={cn(
                "inline-flex cursor-pointer rounded-[5px] outline-none",
                "hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40",
                className
              )}
              aria-label={`Change status, currently ${currentStatus.label}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <TaskStatusMark status={normalized} size="chip" />
            </button>
          ) : (
            <button
              type="button"
              data-task-action
              aria-disabled={disabled || undefined}
              className={cn(
                "inline-flex h-9 w-full min-w-0 max-w-full items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold shadow-primary-btn",
                "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                currentStatus.blockClassName,
                statusTriggerTextClass,
                className
              )}
              aria-label={`Change status, currently ${currentStatus.label}`}
              onClick={(e) => e.stopPropagation()}
            >
              <CurrentStatusIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate font-semibold">
                {currentStatus.label}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          className="z-[120] min-w-[12rem] data-[state=closed]:animate-none"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {TASK_STATUS_ORDER.map((statusId) => {
            const visual: TaskStatusVisual = getTaskStatusVisual(statusId);
            const Icon = visual.Icon;
            const selected = normalized === statusId;
            return (
              <DropdownMenuItem
                key={statusId}
                disabled={disabled || selected}
                onSelect={() => {
                  setIsOpen(false);
                  onStatusChange(statusId);
                }}
                className="gap-2"
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px]",
                    visual.blockClassName
                  )}
                >
                  <Icon className={cn("h-3 w-3", visual.iconClassName)} aria-hidden />
                </span>
                <span className={cn(selected && "font-semibold")}>{visual.label}</span>
                {selected ? (
                  <Check className="ml-auto h-3.5 w-3.5 opacity-60" aria-hidden />
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
