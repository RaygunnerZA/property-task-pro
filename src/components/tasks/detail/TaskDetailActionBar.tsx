import { useEffect, useRef, useState } from "react";
import {
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskDetailChecklistActions } from "@/components/tasks/detail/TaskDetailChecklistTab";
import { TaskStatusDropdown } from "@/components/tasks/TaskStatusDropdown";
import type { TaskStatus } from "@/types/database";
import { cn } from "@/lib/utils";

/** Hide leading icons once the primary CTA no longer fits comfortably. */
const ACTION_ICONS_COMPACT_MAX_WIDTH = 220;

type TaskDetailActionBarProps = {
  status: TaskStatus | string;
  isUpdating: boolean;
  canManage: boolean;
  taskEditOpen: boolean;
  hasEdits: boolean;
  /** Pending edits — status CTA becomes “Update.” (status colour). */
  showUpdate: boolean;
  /** After assignee engagement on a Not started task — primary Begin Task CTA. */
  beginPrompt?: boolean;
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

/**
 * Smart primary actions for Task Detail.
 * Status CTA (Begin Task / Update. / status label) + More
 */
export function TaskDetailActionBar({
  status,
  isUpdating,
  canManage,
  taskEditOpen,
  hasEdits,
  showUpdate,
  beginPrompt = false,
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
  const [moreLocked, setMoreLocked] = useState(false);
  const [hideIcons, setHideIcons] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  const normalized = String(status ?? "open").toLowerCase() as TaskStatus;
  const isTerminal = normalized === "completed" || normalized === "archived";
  const isStarted =
    normalized === "in_progress" || normalized === "waiting_review";
  const showBeginPrompt = beginPrompt && normalized === "open";
  const showSplitCta = showUpdate || showBeginPrompt;

  useEffect(() => {
    if (statusOpen) {
      setMoreLocked(true);
      setMoreOpen(false);
      return;
    }
    const unlock = window.setTimeout(() => setMoreLocked(false), 180);
    return () => window.clearTimeout(unlock);
  }, [statusOpen]);

  useEffect(() => {
    const el = actionsRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const sync = () => {
      setHideIcons(el.clientWidth < ACTION_ICONS_COMPACT_MAX_WIDTH);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showSplitCta]);

  if (!canManage) return null;

  return (
    <div className="flex min-w-0 w-full flex-nowrap items-center gap-1.5 py-[18px]">
      <div
        ref={actionsRef}
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
      >
        <div
          className={cn(
            "min-w-0",
            showSplitCta ? "shrink" : "flex-1 overflow-hidden"
          )}
        >
          <TaskStatusDropdown
            status={status}
            variant="button"
            disabled={isUpdating}
            open={statusOpen}
            onOpenChange={setStatusOpen}
            onStatusChange={onStatusChange}
            beginPrompt={showBeginPrompt}
            pendingUpdate={showUpdate}
            onSaveUpdate={onSaveEdits}
            updateDisabled={!hasEdits}
            hideIcons={hideIcons}
            className={showSplitCta ? undefined : "w-full"}
          />
        </div>
      </div>

      <div
        className={cn(
          "relative z-10 shrink-0",
          (moreLocked || isUpdating) && "pointer-events-none"
        )}
      >
        <DropdownMenu
          modal={false}
          open={moreOpen}
          onOpenChange={(next) => {
            if (moreLocked || isUpdating) {
              setMoreOpen(false);
              return;
            }
            setMoreOpen(next);
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-transparent shadow-e1 outline-none hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="z-[120] min-w-[12rem] data-[state=closed]:animate-none"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
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
    </div>
  );
}
