import { useState } from "react";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useTrashedTasks, type TrashedTaskRow } from "@/hooks/useTrashedTasks";
import { restoreTask, deleteTask } from "@/services/tasks/taskMutations";
import {
  TASK_TRASH_RETENTION_DAYS,
  taskTrashDaysRemaining,
} from "@/lib/taskTrash";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export default function SettingsTrash() {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading, isError, error, refetch } = useTrashedTasks();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingPermanent, setPendingPermanent] = useState<TrashedTaskRow | null>(null);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["trashed-tasks"] });
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    await refetch();
  };

  const handleRestore = async (task: TrashedTaskRow) => {
    if (!orgId || busyId) return;
    setBusyId(task.id);
    try {
      await restoreTask(task.id, orgId);
      toast.success("Task restored");
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't restore task");
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!orgId || !pendingPermanent || busyId) return;
    const task = pendingPermanent;
    setBusyId(task.id);
    try {
      await deleteTask(task.id, orgId);
      toast.success("Task permanently deleted");
      setPendingPermanent(null);
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete task");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Trash</h2>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Deleted tasks stay here for {TASK_TRASH_RETENTION_DAYS} days, then are permanently
          removed. Restore anything you still need.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading trash…
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Couldn't load trash."}
        </p>
      ) : tasks.length === 0 ? (
        <div className="rounded-[10px] bg-card/60 px-4 py-8 text-center shadow-e1">
          <Trash2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">Trash is empty</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Deleted tasks will appear here for {TASK_TRASH_RETENTION_DAYS} days.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => {
            const daysLeft = taskTrashDaysRemaining(task.updated_at);
            const isBusy = busyId === task.id;
            return (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-card/60 px-4 py-3 shadow-e1"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Deleted{" "}
                    {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                    {" · "}
                    {daysLeft === 0
                      ? "Expires today"
                      : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isBusy || Boolean(busyId)}
                    onClick={() => void handleRestore(task)}
                  >
                    {isBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Restore
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={isBusy || Boolean(busyId)}
                    onClick={() => setPendingPermanent(task)}
                  >
                    Delete forever
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={pendingPermanent != null}
        onOpenChange={(open) => {
          if (!open) setPendingPermanent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete forever?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{pendingPermanent?.title ?? "this task"}&quot;
              and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handlePermanentDelete()}
            >
              {busyId === pendingPermanent?.id ? "Deleting…" : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
