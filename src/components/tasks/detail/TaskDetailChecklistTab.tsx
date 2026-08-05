import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { LoadingState } from "@/components/design-system/LoadingState";
import { useSubtasks } from "@/hooks/useSubtasks";
import { useChecklistTemplates } from "@/hooks/useChecklistTemplates";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { applyTemplateToTask } from "@/services/tasks/taskMutations";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SubtaskList,
  type SubtaskData,
  getStepType,
  stepTypeToLegacy,
  resolveIsSubStep,
} from "@/components/tasks/subtasks";
import { rowToChecklistItem } from "@/lib/subtaskPersist";

type TaskDetailChecklistTabProps = {
  taskId: string;
  canEdit: boolean;
  /** Manager+ — show Manage Checklists (overflow / menu consumers). */
  canManageTemplates?: boolean;
  /** When true, only render the list (header actions are rendered by the parent). */
  listOnly?: boolean;
  /** Use the create-task style editor (step types, indent, etc.). */
  editMode?: boolean;
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
            onSelect={() => void handleApplyTemplate(t.id)}
            disabled={applyingTemplateId === t.id || templatesLoading}
          >
            Apply “{t.name}”
          </DropdownMenuItem>
        ))}
        {canManageTemplates ? (
          <DropdownMenuItem onSelect={() => navigate("/manage/templates")}>
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
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={templatesLoading || applyingTemplateId !== null}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Use template
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-[120] max-h-64 overflow-y-auto">
            {templates.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onSelect={() => void handleApplyTemplate(t.id)}
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
  editMode = false,
}: TaskDetailChecklistTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    subtasks,
    loading,
    createSubtask,
    toggleSubtask,
    deleteSubtask,
    updateSubtask,
    updateSubtaskOrder,
    refresh,
  } = useSubtasks(taskId);

  const [editorItems, setEditorItems] = useState<SubtaskData[]>([]);

  useEffect(() => {
    setEditorItems(subtasks.map(rowToChecklistItem));
  }, [subtasks]);

  const bumpCount = () => {
    void queryClient.invalidateQueries({ queryKey: ["task-subtask-count", taskId] });
  };

  /** Authoring mode: change structure/types. Otherwise show requirements for completion. */
  const isAuthoring = canEdit && editMode;

  const handleEditorChange = async (next: SubtaskData[]) => {
    if (!isAuthoring) {
      // Completion / execute mode — only completion toggles are persisted here.
      for (const item of next) {
        const before = editorItems.find((s) => s.id === item.id);
        if (!before) continue;
        if (Boolean(before.is_completed) !== Boolean(item.is_completed)) {
          const ok = await toggleSubtask(item.id);
          if (!ok) {
            toast({ title: "Couldn't update step", variant: "destructive" });
            await refresh();
            return;
          }
        }
      }
      setEditorItems(next);
      bumpCount();
      await refresh();
      return;
    }

    const prev = editorItems;
    setEditorItems(next);

    const serverIds = new Set(subtasks.map((s) => String(s.id)));
    const nextIds = new Set(next.map((s) => s.id));

    for (const item of prev) {
      if (serverIds.has(item.id) && !nextIds.has(item.id)) {
        const ok = await deleteSubtask(item.id);
        if (!ok) {
          toast({ title: "Couldn't remove item", variant: "destructive" });
          await refresh();
          return;
        }
      }
    }

    let createdAny = false;
    for (let index = 0; index < next.length; index++) {
      const item = next[index];
      const stepType = getStepType(item);
      const legacy = stepTypeToLegacy(stepType);
      const isSubStep = resolveIsSubStep(item);
      if (!serverIds.has(item.id)) {
        const created = await createSubtask(item.title.trim() || "Checklist item", {
          is_yes_no: legacy.is_yes_no,
          requires_signature: legacy.requires_signature,
          step_type: stepType,
          is_sub_step: isSubStep,
          is_required: Boolean(item.is_required),
          order_index: index,
        });
        if (!created) {
          toast({ title: "Couldn't add item", variant: "destructive" });
          await refresh();
          return;
        }
        createdAny = true;
        continue;
      }

      const before = prev.find((s) => s.id === item.id);
      if (
        before &&
        (before.title !== item.title ||
          getStepType(before) !== stepType ||
          resolveIsSubStep(before) !== isSubStep ||
          Boolean(before.is_required) !== Boolean(item.is_required) ||
          Boolean(before.is_yes_no) !== legacy.is_yes_no ||
          Boolean(before.requires_signature) !== legacy.requires_signature)
      ) {
        const ok = await updateSubtask(item.id, {
          title: item.title,
          is_yes_no: legacy.is_yes_no,
          requires_signature: legacy.requires_signature,
          step_type: stepType,
          is_sub_step: isSubStep,
          is_required: Boolean(item.is_required),
          order_index: index,
        });
        if (!ok) {
          toast({ title: "Couldn't update item", variant: "destructive" });
          await refresh();
          return;
        }
      }
    }

    const persistedOrder = next.map((s) => s.id).filter((id) => serverIds.has(id));
    if (!createdAny && persistedOrder.length > 1) {
      await updateSubtaskOrder(persistedOrder);
    }

    bumpCount();
    await refresh();
  };

  const handleAddItem = async () => {
    if (!canEdit) return;
    if (isAuthoring) {
      const blank: SubtaskData = {
        id: crypto.randomUUID(),
        title: "",
        is_yes_no: false,
        requires_signature: false,
        step_type: "check",
      };
      void handleEditorChange([...editorItems, blank]);
      return;
    }
    const created = await createSubtask("New checklist item", { step_type: "check" });
    if (!created) {
      toast({ title: "Couldn't add item", variant: "destructive" });
      return;
    }
    bumpCount();
  };

  if (loading) {
    return <LoadingState message="Loading checklist…" />;
  }

  const doneCount = subtasks.filter((row) => Boolean(row.is_completed || row.completed)).length;

  return (
    <div className="space-y-3">
      {!listOnly ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Checklist</h3>
            {subtasks.length > 0 ? (
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {doneCount}/{subtasks.length} done
              </p>
            ) : null}
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => void handleAddItem()}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add item
            </button>
          ) : null}
        </div>
      ) : null}

      {editorItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isAuthoring
            ? "No checklist items yet. Add steps like Create Task."
            : "No checklist items yet."}
        </p>
      ) : (
        <SubtaskList
          subtasks={editorItems}
          isCreator={isAuthoring}
          onSubtasksChange={(next) => {
            if (!isAuthoring && !canEdit) return;
            void handleEditorChange(next);
          }}
        />
      )}

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
