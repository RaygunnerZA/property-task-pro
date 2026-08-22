import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2, RotateCcw, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useTrashedTasks, type TrashedTaskRow } from "@/hooks/useTrashedTasks";
import { restoreTask } from "@/services/tasks/taskMutations";
import { FilterChip } from "@/components/chips/filter";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RestoreArchivedTasksSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type RecencyFilter = "all" | "7d" | "30d";

const RECENCY_FILTERS: { id: RecencyFilter; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "7d", label: "7 DAYS" },
  { id: "30d", label: "30 DAYS" },
];

function matchesRecency(updatedAt: string, filter: RecencyFilter, nowMs: number): boolean {
  if (filter === "all") return true;
  const archivedMs = new Date(updatedAt).getTime();
  if (Number.isNaN(archivedMs)) return false;
  const days = filter === "7d" ? 7 : 30;
  return archivedMs >= nowMs - days * 24 * 60 * 60 * 1000;
}

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
  const { data: properties = [] } = usePropertiesQuery();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>("all");
  const [propertyFilterId, setPropertyFilterId] = useState<string | null>(null);

  const propertyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const property of properties) {
      if (property?.id) {
        map.set(String(property.id), String(property.name ?? "Property"));
      }
    }
    return map;
  }, [properties]);

  const propertyFilterOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const task of tasks) {
      if (task.property_id) ids.add(task.property_id);
    }
    return [...ids]
      .map((id) => ({ id, label: propertyNameById.get(id) ?? "Property" }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [tasks, propertyNameById]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const nowMs = Date.now();
    return tasks
      .filter((task) => {
        if (propertyFilterId && task.property_id !== propertyFilterId) return false;
        if (!matchesRecency(task.updated_at, recencyFilter, nowMs)) return false;
        if (!q) return true;
        const title = task.title?.toLowerCase() ?? "";
        const propertyName = task.property_id
          ? (propertyNameById.get(task.property_id) ?? "").toLowerCase()
          : "";
        return title.includes(q) || propertyName.includes(q);
      })
      .slice(0, 40);
  }, [tasks, searchQuery, recencyFilter, propertyFilterId, propertyNameById]);

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

  const propertyLabel = (task: TrashedTaskRow) =>
    task.property_id ? propertyNameById.get(task.property_id) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>Archived tasks</SheetTitle>
          <SheetDescription>
            Latest archived completed tasks. Restore returns a task to Not started.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="relative flex items-center gap-2 rounded-[10px] bg-background px-2.5 py-2 shadow-[inset_1px_2px_4px_rgba(0,0,0,0.08),inset_-1px_-1px_2px_rgba(255,255,255,0.5)]">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search archived tasks…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              aria-label="Search archived tasks"
            />
          </div>

          <div className="space-y-2" role="group" aria-label="Filter archived tasks">
            <div className="flex flex-wrap gap-1.5">
              {RECENCY_FILTERS.map((filter) => (
                <FilterChip
                  key={filter.id}
                  label={filter.label}
                  selected={recencyFilter === filter.id}
                  onSelect={() => setRecencyFilter(filter.id)}
                  className="h-[24px]"
                />
              ))}
            </div>
            {propertyFilterOptions.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  label="ALL PROPERTIES"
                  selected={propertyFilterId == null}
                  onSelect={() => setPropertyFilterId(null)}
                  className="h-[24px]"
                />
                {propertyFilterOptions.map((property) => (
                  <FilterChip
                    key={property.id}
                    label={property.label.toUpperCase()}
                    selected={propertyFilterId === property.id}
                    onSelect={() =>
                      setPropertyFilterId((current) =>
                        current === property.id ? null : property.id
                      )
                    }
                    className="h-[24px]"
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

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
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No archived tasks yet.</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No archived tasks match your filters.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((task) => {
                const isBusy = busyId === task.id;
                const property = propertyLabel(task);
                return (
                  <li
                    key={task.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-[10px] bg-card/70 px-3 py-2.5 shadow-sm"
                    )}
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
                        {property ? ` · ${property}` : null}
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
