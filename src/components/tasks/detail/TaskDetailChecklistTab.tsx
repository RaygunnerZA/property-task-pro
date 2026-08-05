import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { LoadingState } from "@/components/design-system/LoadingState";
import { useSubtasks } from "@/hooks/useSubtasks";
import { useChecklistTemplates } from "@/hooks/useChecklistTemplates";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { applyTemplateToTask } from "@/services/tasks/taskMutations";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TaskDetailChecklistTabProps = {
  taskId: string;
  canEdit: boolean;
  /** Manager+ — show Manage Checklists (overflow / menu consumers). */
  canManageTemplates?: boolean;
  /** When true, only render the list (header actions are rendered by the parent). */
  listOnly?: boolean;
};

/** Template actions for overflow menus (Task Detail More menu). */
export function TaskDetailChecklistActions({
  taskId,
  canEdit,
  canManageTemplates = false,
  hasItems,
  menuOnly = false,
}: {
  taskId: string;
  canEdit: boolean;
  canManageTemplates?: boolean;
  hasItems: boolean;
  /** Render only template/manage items for an external DropdownMenu. */
  menuOnly?: boolean;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { orgId } = useActiveOrg();
  const { templates, loading: templatesLoading } = useChecklistTemplates(canEdit || canManageTemplates);
  const { refresh } = useSubtasks(taskId);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);

  const handleApplyTemplate = async (templateId: string) => {
    if (!orgId || !canEdit) return;
    setApplyingTemplateId(templateId);
    try {
      await applyTemplateToTask(taskId, templateId, orgId);
      await refresh();
      toast({ title: "Checklist template applied" });
    } catch (err: unknown) {
      toast({
        title: "Couldn't apply template",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setApplyingTemplateId(null);
    }
  };

  if (menuOnly) {
    return (
      <>
        {canEdit && templates.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => void handleApplyTemplate(t.id)}
            disabled={applyingTemplateId === t.id || templatesLoading}
          >
            Apply “{t.name}”
          </DropdownMenuItem>
        ))}
        {canManageTemplates ? (
          <DropdownMenuItem onClick={() => navigate("/manage/templates")}>
            Manage checklists
          </DropdownMenuItem>
        ) : null}
      </>
    );
  }

  if (!canEdit && !canManageTemplates) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {!hasItems && canEdit && templates.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={templatesLoading || applyingTemplateId !== null}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Use template
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            {templates.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => void handleApplyTemplate(t.id)}
                disabled={applyingTemplateId === t.id}
              >
                {t.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </span>
  );
}

export function TaskDetailChecklistTab({
  taskId,
  canEdit,
  canManageTemplates = false,
  listOnly = false,
}: TaskDetailChecklistTabProps) {
  const { toast } = useToast();
  const {
    subtasks,
    loading,
    createSubtask,
    toggleSubtask,
    deleteSubtask,
  } = useSubtasks(taskId);

  const handleAddItem = async () => {
    if (!canEdit) return;
    const created = await createSubtask("New checklist item");
    if (!created) {
      toast({ title: "Couldn't add item", variant: "destructive" });
    }
  };

  if (loading) {
    return <LoadingState message="Loading checklist…" />;
  }

  return (
    <div className="space-y-3">
      {!listOnly ? (
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-foreground">Checklist</h3>
          {canEdit ? (
            <button
              type="button"
              onClick={() => void handleAddItem()}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add item
            </button>
          ) : null}
        </div>
      ) : null}

      {subtasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No checklist items yet.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {subtasks.map((row) => {
            const done = Boolean(row.is_completed || row.completed);
            return (
              <li key={row.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  checked={done}
                  disabled={!canEdit}
                  onChange={() => void toggleSubtask(row.id)}
                  aria-label={`Mark ${row.title} complete`}
                />
                <span
                  className={cn(
                    "flex-1 text-sm leading-snug text-foreground",
                    done && "text-muted-foreground line-through"
                  )}
                >
                  {row.title}
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-destructive"
                    onClick={() => void deleteSubtask(row.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {/* Keep template manage available for empty state without crowding the page */}
      {!listOnly && subtasks.length === 0 && canEdit ? (
        <TaskDetailChecklistActions
          taskId={taskId}
          canEdit={canEdit}
          canManageTemplates={canManageTemplates}
          hasItems={false}
        />
      ) : null}
    </div>
  );
}
