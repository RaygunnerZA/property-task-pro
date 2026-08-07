import { useState } from "react";
import {
  Archive,
  Check,
  ChevronDown,
  CirclePause,
  Copy,
  Pencil,
  Play,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  /** Show Update when the user has made checklist / comment / detail changes. */
  showUpdate: boolean;
  taskId: string;
  canManageTemplates: boolean;
  onStartTask: () => void;
  onAddUpdate: () => void;
  onMarkComplete: () => void;
  onStatusChange: (next: TaskStatus) => void;
  onEditDetails: () => void;
  onDoneEditing: () => void;
  onSaveEdits: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onDelete: () => void;
};

/**
 * Smart primary actions for Task Detail.
 * Not started → Start + Mark complete + More
 * In progress / on hold → Update (when dirty) + Mark complete + More
 *
 * Normal single-line buttons by default; wrap to a second row when the
 * column is too narrow to fit them without clipping.
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
  onStartTask,
  onAddUpdate,
  onMarkComplete,
  onStatusChange,
  onEditDetails,
  onDoneEditing,
  onSaveEdits,
  onDuplicate,
  onShare,
  onDelete,
}: TaskDetailActionBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const normalized = String(status ?? "open").toLowerCase() as TaskStatus;
  const isTerminal = normalized === "completed" || normalized === "archived";
  const isStarted =
    normalized === "in_progress" || normalized === "waiting_review";
  const notStarted = normalized === "open" || (!isStarted && !isTerminal);

  if (!canManage) return null;

  const growBtn =
    "min-w-[9.5rem] flex-1 basis-[9.5rem] font-semibold";

  return (
    <div className="flex min-w-0 w-full flex-wrap items-center gap-2">
      {taskEditOpen ? (
        <Button
          type="button"
          variant="outline"
          className="shrink-0 shadow-e1"
          onClick={onSaveEdits}
          disabled={isUpdating || !hasEdits}
          title={hasEdits ? "Save changes" : "No changes to save"}
        >
          {isUpdating ? "…" : "Save"}
        </Button>
      ) : null}

      {!isTerminal && notStarted ? (
        <Button
          type="button"
          data-task-action
          className={cn(growBtn, "shadow-primary-btn")}
          disabled={isUpdating}
          onClick={onStartTask}
        >
          <Play className="h-4 w-4" aria-hidden />
          Start task
        </Button>
      ) : null}

      {!isTerminal && isStarted && showUpdate ? (
        <Button
          type="button"
          data-task-action
          variant="outline"
          className={cn(growBtn, "shadow-e1")}
          disabled={isUpdating}
          onClick={onAddUpdate}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Update
        </Button>
      ) : null}

      {!isTerminal ? (
        <Button
          type="button"
          data-task-action
          variant={isStarted ? "default" : "outline"}
          className={cn(
            growBtn,
            isStarted ? "shadow-primary-btn" : "shadow-e1"
          )}
          disabled={isUpdating}
          onClick={onMarkComplete}
        >
          <Check className="h-4 w-4" aria-hidden />
          Mark complete
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className={cn(growBtn, "pointer-events-none opacity-80 shadow-e1")}
          disabled
        >
          <Check className="h-4 w-4" aria-hidden />
          {normalized === "archived" ? "Cancelled" : "Completed"}
        </Button>
      )}

      <DropdownMenu modal={false} open={moreOpen} onOpenChange={setMoreOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-1 px-3 shadow-e1"
            aria-label="More"
            disabled={isUpdating}
          >
            More
            <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[120] min-w-[12rem]">
          {!isTerminal ? (
            <>
              {isStarted && !showUpdate ? (
                <DropdownMenuItem onSelect={() => onAddUpdate()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Progress note
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                disabled={isUpdating || normalized === "waiting_review"}
                onSelect={() => onStatusChange("waiting_review")}
              >
                <CirclePause className="mr-2 h-4 w-4" />
                Put on hold
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isUpdating || normalized === "archived"}
                onSelect={() => onStatusChange("archived")}
              >
                <Archive className="mr-2 h-4 w-4" />
                Cancel task
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
            </>
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
          {hasEdits ? (
            <DropdownMenuItem onSelect={() => onSaveEdits()} disabled={isUpdating}>
              Save changes
            </DropdownMenuItem>
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
