import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useTrashedTasks } from "@/hooks/useTrashedTasks";
import { restoreTask } from "@/services/tasks/taskMutations";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";

type RestoreArchivedTasksSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Latest archived tasks (Trash path). Restore uses restore_task → open.
 */
export function RestoreArchivedTasksSheet({
  open,
  onOpenChange,
}: RestoreArchivedTasksSheetProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading, isError, error, refetch } = useTrashedTasks();
  const [busyId, setBusyId] = useState<string | null>(null);

  const latest = tasks.slice(0, 40);

  const handleRestore = async (taskId: string) => {
    if (!orgId || busyId) return;
    setBusyId(taskId);
    try {
      await restoreTask(taskId, orgId);
      toast.success("Task restored");
      await queryClient.invalidateQueries({ queryKey: ["trashed-tasks"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't restore task");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>Archived tasks</SheetTitle>
          <SheetDescription>
            Latest archived completed tasks. Restore returns a task to Not started.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading archived tasks…
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : "Couldn't load archived tasks."}
            </p>
          ) : latest.length === 0 ? (
            <p className="text-sm text-muted-foreground">No archived tasks yet.</p>
          ) : (
            <ul className="space-y-2">
              {latest.map((task) => {
                const isBusy = busyId === task.id;
                return (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-[10px] bg-card/70 px-3 py-2.5 shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {task.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Archived{" "}
                        {formatDistanceToNow(new Date(task.updated_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={isBusy || Boolean(busyId)}
                      onClick={() => void handleRestore(task.id)}
                      className="shrink-0 gap-1.5"
                    >
                      {isBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Restore
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
