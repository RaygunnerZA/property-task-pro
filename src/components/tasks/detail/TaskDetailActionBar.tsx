import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskDetailChecklistActions } from "@/components/tasks/detail/TaskDetailChecklistTab";
import {
  getTaskStatusVisual,
  TASK_STATUS_ORDER,
  type TaskStatusVisual,
} from "@/lib/taskStatus";
import type { TaskStatus } from "@/types/database";
import { cn } from "@/lib/utils";

type TaskDetailActionBarProps = {
  status: TaskStatus | string;
  isUpdating: boolean;
  canManage: boolean;
  taskEditOpen: boolean;
  hasEdits: boolean;
  /** Show turquoise UPDATE when title/checklist/details have pending saves. */
  showUpdate: boolean;
  taskId: string;
  canManageTemplates: boolean;
  onAddUpdate: () => void;
  onStatusChange: (next: TaskStatus) => void;
  onEditDetails: () => void;
  onDoneEditing: () => void;
  onSaveEdits: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onDelete: () => void;
};

/** Collapse More → ••• when the action bar is narrower than this. */
const MORE_COMPACT_MAX_WIDTH = 380;

/**
 * Smart primary actions for Task Detail.
 * Change status + (optional turquoise UPDATE) + More
 */
export function TaskDetailActionBar({
  status,
  isUpdating,
  canManage,
  taskEditOpen,
  hasEdits,
  showUpdate,
  taskId,
  canManageTemplates,
  onAddUpdate,
  onStatusChange,
  onEditDetails,
  onDoneEditing,
  onSaveEdits,
  onDuplicate,
  onShare,
  onDelete,
}: TaskDetailActionBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [moreCompact, setMoreCompact] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const normalized = String(status ?? "open").toLowerCase() as TaskStatus;
  const isTerminal = normalized === "completed" || normalized === "archived";
  const isStarted =
    normalized === "in_progress" || normalized === "waiting_review";

  const currentStatus = getTaskStatusVisual(normalized);
  const CurrentStatusIcon = currentStatus.Icon;
  /** Dark status fills use white label text; light "not started" stays muted. */
  const statusTriggerTextClass =
    normalized === "open" ? "text-muted-foreground" : "text-white";

  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const sync = () => setMoreCompact(el.clientWidth < MORE_COMPACT_MAX_WIDTH);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!canManage) return null;

  return (
    <div ref={barRef} className="flex min-w-0 w-full flex-nowrap items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="w-[4.5rem] shrink-0 text-left font-mono text-caption uppercase leading-tight tracking-wide text-muted-foreground"
          aria-hidden
        >
          Change
          <br />
          status
        </span>
        <DropdownMenu modal={false} open={statusOpen} onOpenChange={setStatusOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-task-action
              className={cn(
                "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-semibold shadow-e1 transition-[opacity,background-color,color]",
                "disabled:pointer-events-none disabled:opacity-50",
                "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                currentStatus.blockClassName,
                statusTriggerTextClass
              )}
              disabled={isUpdating}
              aria-label={`Change status, currently ${currentStatus.label}`}
            >
              <CurrentStatusIcon className="h-4 w-4 shrink-0" aria-hidden />
              {/* Reserve width for the longest status label so the control doesn’t shrink on change. */}
              <span className="relative inline-flex min-w-[7.25rem] items-center justify-center">
                <span className="invisible whitespace-nowrap font-semibold" aria-hidden>
                  Not started
                </span>
                <span className="absolute inset-0 flex items-center justify-center whitespace-nowrap font-semibold">
                  {currentStatus.label}
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-[120] min-w-[12rem]">
            {TASK_STATUS_ORDER.map((statusId) => {
              const visual: TaskStatusVisual = getTaskStatusVisual(statusId);
              const Icon = visual.Icon;
              const selected = normalized === statusId;
              return (
                <DropdownMenuItem
                  key={statusId}
                  disabled={isUpdating || selected}
                  onSelect={() => onStatusChange(statusId)}
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

      {showUpdate ? (
        <Button
          type="button"
          data-task-action
          className="h-9 shrink-0 px-4 font-mono text-caption uppercase tracking-wide shadow-primary-btn"
          disabled={isUpdating || !hasEdits}
          onClick={onSaveEdits}
          title={hasEdits ? "Save changes" : "No changes to save"}
        >
          {isUpdating ? "…" : "Update"}
        </Button>
      ) : null}

      <DropdownMenu modal={false} open={moreOpen} onOpenChange={setMoreOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "shrink-0 shadow-e1",
              moreCompact ? "h-9 w-9 px-0" : "gap-1 px-3"
            )}
            aria-label="More"
            disabled={isUpdating}
          >
            {moreCompact ? (
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            ) : (
              <>
                More
                <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[120] min-w-[12rem]">
          {!isTerminal && isStarted ? (
            <DropdownMenuItem onSelect={() => onAddUpdate()}>
              <Plus className="mr-2 h-4 w-4" />
              Progress note
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem
            onSelect={() => {
              onEditDetails();
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit details
          </DropdownMenuItem>
          {taskEditOpen ? (
            <DropdownMenuItem onSelect={() => onDoneEditing()}>Done editing</DropdownMenuItem>
          ) : null}

          <TaskDetailChecklistActions
            taskId={taskId}
            canEdit={canManage}
            canManageTemplates={canManageTemplates}
            hasItems
            menuOnly
          />

          <DropdownMenuItem onSelect={() => onShare()}>
            <Share2 className="mr-2 h-4 w-4" />
            Share task
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onDuplicate()} disabled={isUpdating}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => onDelete()}
            disabled={isUpdating}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
