import { useState } from "react";
import { Check, ChevronDown, Play } from "lucide-react";
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
  /**
   * When status is still Not started and the assignee has engaged (comment/edit),
   * surface a blue “Begin Task” CTA that activates the task.
   */
  beginPrompt?: boolean;
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
  beginPrompt = false,
}: TaskStatusDropdownProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setIsOpen = onOpenChange ?? setUncontrolledOpen;

  const normalized = String(status ?? "open").toLowerCase() as TaskStatus;
  const currentStatus = getTaskStatusVisual(normalized);
  const CurrentStatusIcon = currentStatus.Icon;
  const showBeginCta =
    beginPrompt && variant === "button" && normalized === "open";
  const statusTriggerTextClass = showBeginCta
    ? "text-white"
    : normalized === "open"
      ? "text-muted-foreground"
      : "text-white";
  const triggerBlockClass = showBeginCta
    ? "bg-blue-500"
    : currentStatus.blockClassName;

  const statusMenu = (
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
            <span className={cn(selected && "font-semibold")}>
              {showBeginCta && statusId === "in_progress"
                ? "Begin Task"
                : visual.label}
            </span>
            {selected ? (
              <Check className="ml-auto h-3.5 w-3.5 opacity-60" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  );

  return (
    <div
      className={cn(
        variant === "button"
          ? showBeginCta
            ? "inline-flex shrink-0 overflow-visible"
            : "w-full min-w-0 max-w-full overflow-visible"
          : "inline-flex",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      {showBeginCta ? (
        <div
          className={cn(
            "inline-flex h-9 shrink-0 overflow-visible rounded-md border-0 shadow-primary-btn",
            triggerBlockClass,
            className
          )}
        >
          <button
            type="button"
            data-task-action
            aria-disabled={disabled || undefined}
            disabled={disabled}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3.5 text-sm font-semibold",
              statusTriggerTextClass,
              "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label="Begin task"
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              onStatusChange("in_progress");
            }}
          >
            <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden />
            <span className="whitespace-nowrap font-semibold">Begin Task</span>
          </button>
          <DropdownMenu
            modal={false}
            open={isOpen}
            onOpenChange={(next) => {
              if (disabled && next) return;
              setIsOpen(next);
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-task-action
                aria-disabled={disabled || undefined}
                disabled={disabled}
                className={cn(
                  "inline-flex h-full w-9 shrink-0 items-center justify-center border-l border-white/30",
                  statusTriggerTextClass,
                  "hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                aria-label="Change status"
                onClick={(e) => e.stopPropagation()}
              >
                <ChevronDown className="h-3.5 w-3.5 opacity-90" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            {statusMenu}
          </DropdownMenu>
        </div>
      ) : (
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
                  triggerBlockClass,
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
          {statusMenu}
        </DropdownMenu>
      )}
    </div>
  );
}
