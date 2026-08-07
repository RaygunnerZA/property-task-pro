import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { LoadingState } from "@/components/design-system/LoadingState";
import { useSubtasks } from "@/hooks/useSubtasks";
import {
  useChecklistTemplates,
  type ChecklistTemplateCategory,
} from "@/hooks/useChecklistTemplates";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useAuth } from "@/hooks/useAuth";
import { applyTemplateToTask } from "@/services/tasks/taskMutations";
import {
  completeChecklistStep,
  clearChecklistStepResponse,
  getChecklistGeoCached,
} from "@/services/checklist/completeChecklistStep";
import { useToast } from "@/hooks/use-toast";
import { toErrorMessage } from "@/lib/error";
import type { ChecklistStepResponseInput } from "@/lib/checklistStepResponse";
import { serializeChecklistTemplateItems } from "@/lib/checklistTemplateItems";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const TITLE_PERSIST_DEBOUNCE_MS = 450;

type TaskDetailChecklistTabProps = {
  taskId: string;
  canEdit: boolean;
  /** Manager+ — show Manage Checklists (overflow / menu consumers). */
  canManageTemplates?: boolean;
  /** When true, only render the list (header actions are rendered by the parent). */
  listOnly?: boolean;
  /** Use the create-task style editor (step types, indent, etc.). */
  editMode?: boolean;
  /**
   * Compact create-task style checklist under the description while editing
   * (Add step + Templates | Save Checklist | Manage).
   */
  composerEmbed?: boolean;
  /** Fired after checklist structure or responses change in this session. */
  onSessionChange?: () => void;
};

const TEMPLATE_CATEGORIES: { value: ChecklistTemplateCategory; label: string }[] = [
  { value: "operations", label: "Operations" },
  { value: "compliance", label: "Compliance" },
  { value: "maintenance", label: "Maintenance" },
  { value: "security", label: "Security" },
];

/** Create-task style footer: Templates | Save Checklist | Manage */
function ChecklistComposerFooter({
  taskId,
  canEdit,
  canManageTemplates,
  items,
  onApplied,
  onRequestSave,
}: {
  taskId: string;
  canEdit: boolean;
  canManageTemplates: boolean;
  items: SubtaskData[];
  onApplied: () => void | Promise<void>;
  onRequestSave: () => void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { orgId } = useActiveOrg();
  const { templates, loading: templatesLoading } = useChecklistTemplates(canEdit || canManageTemplates);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);

  const handleApplyTemplate = async (templateId: string) => {
    if (!orgId || !canEdit) return;
    setApplyingTemplateId(templateId);
    try {
      await applyTemplateToTask(taskId, templateId, orgId);
      await onApplied();
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

  if (!canEdit && !canManageTemplates) return null;

  return (
    <div className="flex items-center justify-end gap-[5px] pt-[3px] pr-1 pb-1 text-xs text-muted-foreground/70">
      {canEdit ? (
        <>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={templatesLoading || applyingTemplateId !== null}
                className="hover:text-muted-foreground transition-colors disabled:opacity-50"
              >
                Templates
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[120] max-h-64 overflow-y-auto">
              {templates.length === 0 ? (
                <DropdownMenuItem disabled>No templates yet</DropdownMenuItem>
              ) : (
                templates.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onSelect={() => void handleApplyTemplate(t.id)}
                    disabled={applyingTemplateId === t.id}
                  >
                    {t.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-muted-foreground/30">|</span>
          <button
            type="button"
            className="hover:text-muted-foreground transition-colors"
            onClick={() => {
              if (serializeChecklistTemplateItems(items).length === 0) {
                toast({ title: "No checklist items", variant: "destructive" });
                return;
              }
              onRequestSave();
            }}
          >
            Save Checklist
          </button>
          <span className="text-muted-foreground/30">|</span>
        </>
      ) : null}
      <button
        type="button"
        className="hover:text-muted-foreground transition-colors"
        onClick={() => navigate("/manage/templates")}
      >
        Manage
      </button>
    </div>
  );
}

/** Template actions for overflow menus (Task Detail More menu). */
export function TaskDetailChecklistActions({
  taskId,
  canEdit,
  canManageTemplates = false,
  hasItems: _hasItems,
  menuOnly = false,
}: {
  taskId: string;
  canEdit: boolean;
  canManageTemplates?: boolean;
  hasItems: boolean;
  /** Render only manage/navigate items for an external DropdownMenu (no Apply template rows). */
  menuOnly?: boolean;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refresh } = useSubtasks(taskId);
  const queryClient = useQueryClient();

  if (menuOnly) {
    if (!canManageTemplates) return null;
    return (
      <DropdownMenuItem onSelect={() => navigate("/manage/templates")}>
        Manage checklists
      </DropdownMenuItem>
    );
  }

  if (!canEdit && !canManageTemplates) return null;

  return (
    <ChecklistComposerFooter
      taskId={taskId}
      canEdit={canEdit}
      canManageTemplates={canManageTemplates}
      items={[]}
      onApplied={async () => {
        await refresh();
        void queryClient.invalidateQueries({ queryKey: ["task-subtask-count", taskId] });
      }}
      onRequestSave={() => {
        toast({ title: "No checklist items", variant: "destructive" });
      }}
    />
  );
}

export function TaskDetailChecklistTab({
  taskId,
  canEdit,
  canManageTemplates = false,
  listOnly = false,
  editMode = false,
  composerEmbed = false,
  onSessionChange,
}: TaskDetailChecklistTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const { user } = useAuth();
  const {
    subtasks,
    loading,
    error: subtasksError,
    createSubtask,
    deleteSubtask,
    updateSubtask,
    updateSubtaskOrder,
    refresh,
  } = useSubtasks(taskId);

  const [editorItems, setEditorItems] = useState<SubtaskData[]>([]);
  const [responseBusyId, setResponseBusyId] = useState<string | null>(null);
  /** Allow authoring checklist structure without full task edit mode (Add item). */
  const [checklistAuthoring, setChecklistAuthoring] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateDraftName, setTemplateDraftName] = useState("");
  const [templateDraftCategory, setTemplateDraftCategory] =
    useState<ChecklistTemplateCategory>("operations");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const editorItemsRef = useRef(editorItems);
  editorItemsRef.current = editorItems;
  const titlePersistTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setEditorItems((prev) => {
      const mapped = subtasks.map(rowToChecklistItem);
      const pending = titlePersistTimersRef.current;

      // Preserve in-flight typed titles so a mid-keystroke sync cannot clobber input.
      const withLocalTitles =
        pending.size === 0
          ? mapped
          : mapped.map((row) => {
              if (!pending.has(row.id)) return row;
              const local = prev.find((p) => p.id === row.id);
              return local ? { ...row, title: local.title } : row;
            });

      // Keep local-only draft rows (Enter-created UUIDs not yet on server).
      const serverIds = new Set(withLocalTitles.map((r) => r.id));
      const localDrafts = prev.filter((p) => !serverIds.has(p.id));
      if (localDrafts.length === 0) return withLocalTitles;

      // Insert drafts after the item they followed in prev order when possible.
      const merged = [...withLocalTitles];
      for (const draft of localDrafts) {
        const prevIndex = prev.findIndex((p) => p.id === draft.id);
        const beforeId = prevIndex > 0 ? prev[prevIndex - 1]?.id : null;
        const insertAt = beforeId
          ? merged.findIndex((m) => m.id === beforeId) + 1
          : merged.length;
        merged.splice(Math.max(insertAt, 0), 0, draft);
      }
      return merged;
    });
  }, [subtasks]);

  useEffect(() => {
    if (editMode) setChecklistAuthoring(false);
  }, [editMode]);

  useEffect(
    () => () => {
      titlePersistTimersRef.current.forEach((timer) => clearTimeout(timer));
      titlePersistTimersRef.current.clear();
    },
    []
  );

  // Prefetch GPS so the first Mark done is not cold (reused ~60s for rapid completions).
  useEffect(() => {
    if (!canEdit) return;
    void getChecklistGeoCached();
  }, [canEdit, taskId]);

  const bumpCount = () => {
    void queryClient.invalidateQueries({ queryKey: ["task-subtask-count", taskId] });
    void queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
    void queryClient.invalidateQueries({ queryKey: ["task-audit-log", orgId, taskId] });
    onSessionChange?.();
  };

  /** Authoring mode: change structure/types. Otherwise show requirements for completion. */
  const isAuthoring = canEdit && (editMode || checklistAuthoring);

  const handleSubmitResponse = async (stepId: string, response: ChecklistStepResponseInput) => {
    if (!orgId || !user?.id || !canEdit) {
      throw new Error("Sign in to record checklist responses.");
    }
    const step = editorItems.find((s) => s.id === stepId);
    if (!step) throw new Error("Checklist step not found.");

    setResponseBusyId(stepId);
    try {
      await completeChecklistStep({
        orgId,
        taskId,
        subtaskId: stepId,
        stepType: getStepType(step),
        response,
        userId: user.id,
      });
      bumpCount();
      await refresh();
      toast({ title: "Response recorded" });
    } catch (err) {
      toast({
        title: "Couldn't record response",
        description: toErrorMessage(err),
        variant: "destructive",
      });
      throw err;
    } finally {
      setResponseBusyId(null);
    }
  };

  const handleEditorChange = async (next: SubtaskData[]) => {
    if (!isAuthoring) {
      // Execute mode persists via onSubmitResponse — ignore structure edits.
      return;
    }

    const prev = editorItems;
    setEditorItems(next);

    const serverIds = new Set(subtasks.map((s) => String(s.id)));
    const nextIds = new Set(next.map((s) => s.id));

    let deletedAny = false;
    for (const item of prev) {
      if (serverIds.has(item.id) && !nextIds.has(item.id)) {
        const pending = titlePersistTimersRef.current.get(item.id);
        if (pending) {
          clearTimeout(pending);
          titlePersistTimersRef.current.delete(item.id);
        }
        const ok = await deleteSubtask(item.id);
        if (!ok) {
          toast({ title: "Couldn't remove item", variant: "destructive" });
          await refresh();
          return;
        }
        deletedAny = true;
      }
    }

    let createdAny = false;
    let structureChangedAny = false;

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
      if (!before) continue;

      const structureChanged =
        getStepType(before) !== stepType ||
        resolveIsSubStep(before) !== isSubStep ||
        Boolean(before.is_required) !== Boolean(item.is_required) ||
        Boolean(before.is_yes_no) !== legacy.is_yes_no ||
        Boolean(before.requires_signature) !== legacy.requires_signature;
      const titleChanged = before.title !== item.title;

      if (!structureChanged && !titleChanged) continue;

      if (structureChanged) {
        structureChangedAny = true;
        const pending = titlePersistTimersRef.current.get(item.id);
        if (pending) {
          clearTimeout(pending);
          titlePersistTimersRef.current.delete(item.id);
        }
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
        continue;
      }

      // Title-only: debounce + silent persist (no list remount / loading flash).
      const existingTimer = titlePersistTimersRef.current.get(item.id);
      if (existingTimer) clearTimeout(existingTimer);
      titlePersistTimersRef.current.set(
        item.id,
        setTimeout(() => {
          void (async () => {
            titlePersistTimersRef.current.delete(item.id);
            const latest = editorItemsRef.current.find((s) => s.id === item.id);
            if (!latest) return;
            const latestType = getStepType(latest);
            const latestLegacy = stepTypeToLegacy(latestType);
            const ok = await updateSubtask(
              item.id,
              {
                title: latest.title,
                is_yes_no: latestLegacy.is_yes_no,
                requires_signature: latestLegacy.requires_signature,
                step_type: latestType,
                is_sub_step: resolveIsSubStep(latest),
                is_required: Boolean(latest.is_required),
                order_index: editorItemsRef.current.findIndex((s) => s.id === item.id),
              },
              { refresh: false }
            );
            if (!ok) {
              toast({ title: "Couldn't update item", variant: "destructive" });
              await refresh();
            }
          })();
        }, TITLE_PERSIST_DEBOUNCE_MS)
      );
    }

    const persistedOrder = next.map((s) => s.id).filter((id) => serverIds.has(id));
    if (!createdAny && !deletedAny && persistedOrder.length > 1) {
      const orderChanged = persistedOrder.some((id, i) => prev[i]?.id !== id);
      if (orderChanged) {
        await updateSubtaskOrder(persistedOrder);
        structureChangedAny = true;
      }
    }

    if (createdAny || deletedAny || structureChangedAny) {
      bumpCount();
      await refresh();
    }
  };

  const handleClearResponse = async (stepId: string) => {
    if (!orgId || !canEdit) return;
    setResponseBusyId(stepId);
    try {
      await clearChecklistStepResponse({ orgId, subtaskId: stepId });
      bumpCount();
      await refresh();
      toast({ title: "Response cleared" });
    } catch (err) {
      toast({
        title: "Couldn't clear response",
        description: toErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setResponseBusyId(null);
    }
  };

  const handleAddItem = async () => {
    if (!canEdit || addingItem) return;
    setChecklistAuthoring(true);
    setAddingItem(true);
    try {
      const created = await createSubtask("", {
        step_type: "check",
        order_index: editorItems.length,
      });
      if (!created) {
        toast({
          title: "Couldn't add item",
          description: subtasksError || undefined,
          variant: "destructive",
        });
        return;
      }
      bumpCount();
      await refresh();
    } finally {
      setAddingItem(false);
    }
  };

  const handleStructureDelete = async (stepId: string) => {
    if (!canEdit) return;
    const ok = await deleteSubtask(stepId);
    if (!ok) {
      toast({ title: "Couldn't remove item", variant: "destructive" });
      return;
    }
    bumpCount();
    await refresh();
  };

  const handleStructureDuplicate = async (stepId: string) => {
    if (!canEdit) return;
    const source = editorItems.find((s) => s.id === stepId);
    if (!source) return;
    const stepType = getStepType(source);
    const legacy = stepTypeToLegacy(stepType);
    const created = await createSubtask(
      source.title.trim() ? `${source.title} (copy)` : "",
      {
        is_yes_no: legacy.is_yes_no,
        requires_signature: legacy.requires_signature,
        step_type: stepType,
        is_sub_step: resolveIsSubStep(source),
        is_required: Boolean(source.is_required),
        order_index: editorItems.length,
      }
    );
    if (!created) {
      toast({ title: "Couldn't duplicate item", variant: "destructive" });
      return;
    }
    bumpCount();
    await refresh();
  };

  const openSaveDialog = () => {
    const items = serializeChecklistTemplateItems(editorItems);
    if (items.length === 0) {
      toast({ title: "No checklist items", variant: "destructive" });
      return;
    }
    setTemplateDraftName(`Checklist ${new Date().toLocaleDateString()}`);
    setTemplateDraftCategory("operations");
    setSaveDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!orgId) {
      toast({ title: "Not signed in", variant: "destructive" });
      return;
    }
    const items = serializeChecklistTemplateItems(editorItems);
    if (items.length === 0) {
      toast({ title: "No checklist items", variant: "destructive" });
      return;
    }
    const name = templateDraftName.trim();
    if (!name) {
      toast({ title: "Template name required", variant: "destructive" });
      return;
    }
    setSavingTemplate(true);
    try {
      const { error } = await supabase
        .from("checklist_templates")
        .insert({
          org_id: orgId,
          name,
          category: templateDraftCategory,
          items,
        });
      if (error) throw error;
      setSaveDialogOpen(false);
      toast({ title: "Template saved", description: `"${name}" saved.` });
    } catch (err) {
      toast({
        title: "Couldn't save template",
        description: toErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  if (loading && subtasks.length === 0) {
    if (composerEmbed) return null;
    return <LoadingState message="Loading checklist…" />;
  }

  const actionableSteps = subtasks.filter((row) => {
    const stepType = String(row.step_type ?? "");
    return stepType !== "title" && stepType !== "note" && stepType !== "divider";
  });
  const doneCount = actionableSteps.filter((row) =>
    Boolean(row.is_completed || row.completed || row.response_value || row.signed_at)
  ).length;

  const footer = canEdit ? (
    <ChecklistComposerFooter
      taskId={taskId}
      canEdit={canEdit}
      canManageTemplates={canManageTemplates}
      items={editorItems}
      onApplied={async () => {
        bumpCount();
        await refresh();
      }}
      onRequestSave={openSaveDialog}
    />
  ) : null;

  const saveDialog = (
    <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Checklist Template</DialogTitle>
          <DialogDescription>
            Save this checklist for quick reuse when creating tasks.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Template name</Label>
            <input
              type="text"
              value={templateDraftName}
              onChange={(e) => setTemplateDraftName(e.target.value)}
              className="w-full h-9 rounded-lg bg-input px-3 text-sm shadow-engraved border-0 outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Category</Label>
            <Select
              value={templateDraftCategory}
              onValueChange={(v) => setTemplateDraftCategory(v as ChecklistTemplateCategory)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSaveTemplate()} disabled={savingTemplate}>
            {savingTemplate ? "Saving…" : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Create-task style: empty checklist is an “Add step” row under the description.
  if (composerEmbed && editorItems.length === 0 && canEdit) {
    return (
      <>
        <div className="group/checklist-embed border-t border-border/15 pt-1">
          <button
            type="button"
            onClick={() => void handleAddItem()}
            disabled={addingItem}
            className="flex w-full items-center gap-2 py-[3px] pl-1.5 pr-1.5 text-left disabled:opacity-60"
          >
            <div className="h-3 w-3 rounded-lg border-2 border-muted-foreground/30 bg-background/50" />
            <span className="flex-1 text-sm text-muted-foreground/70">
              {addingItem ? "Adding…" : "Add step"}
            </span>
          </button>
          {footer}
        </div>
        {saveDialog}
      </>
    );
  }

  if (composerEmbed && canEdit) {
    return (
      <>
        <div className="space-y-1 border-t border-border/15 pt-1">
          <SubtaskList
            subtasks={editorItems}
            isCreator
            onSubtasksChange={(next) => {
              void handleEditorChange(next);
            }}
          />
          <button
            type="button"
            onClick={() => void handleAddItem()}
            disabled={addingItem}
            className="flex w-full items-center gap-2 py-[3px] pl-1.5 pr-1.5 text-left disabled:opacity-60"
          >
            <div className="h-3 w-3 rounded-lg border-2 border-muted-foreground/30 bg-background/50" />
            <span className="flex-1 text-sm text-muted-foreground/70">
              {addingItem ? "Adding…" : "Add step"}
            </span>
          </button>
          {footer}
        </div>
        {saveDialog}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {!listOnly ? (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Checklist</h3>
            {actionableSteps.length > 0 ? (
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {doneCount}/{actionableSteps.length} done
              </p>
            ) : null}
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2 shrink-0">
              {checklistAuthoring && !editMode ? (
                <button
                  type="button"
                  onClick={() => setChecklistAuthoring(false)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Done editing
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleAddItem()}
                disabled={addingItem}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/15",
                  addingItem && "opacity-60"
                )}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add item
              </button>
            </div>
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
            if (!isAuthoring) return;
            void handleEditorChange(next);
          }}
          onSubmitResponse={
            !isAuthoring && canEdit
              ? (id, response) => handleSubmitResponse(id, response)
              : undefined
          }
          responseBusyId={responseBusyId}
          onClearResponse={
            !isAuthoring && canEdit
              ? (id) => handleClearResponse(id)
              : undefined
          }
          canEditStructure={!isAuthoring && canEdit}
          onRequestAuthoring={
            !isAuthoring && canEdit ? () => setChecklistAuthoring(true) : undefined
          }
          onDeleteStep={
            !isAuthoring && canEdit
              ? (id) => handleStructureDelete(id)
              : undefined
          }
          onDuplicateStep={
            !isAuthoring && canEdit
              ? (id) => handleStructureDuplicate(id)
              : undefined
          }
        />
      )}

      {!listOnly && canEdit ? footer : null}
      {saveDialog}
    </div>
  );
}
