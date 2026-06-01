import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
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
};

export function TaskDetailChecklistTab({ taskId, canEdit }: TaskDetailChecklistTabProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { orgId } = useActiveOrg();
  const {
    subtasks,
    loading,
    refresh,
    createSubtask,
    toggleSubtask,
    deleteSubtask,
  } = useSubtasks(taskId);
  const { templates, loading: templatesLoading } = useChecklistTemplates(canEdit);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);

  const handleAddItem = async () => {
    if (!canEdit) return;
    const created = await createSubtask("New checklist item");
    if (!created) {
      toast({
        title: "Couldn't add item",
        variant: "destructive",
      });
    }
  };

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

  if (loading) {
    return <LoadingState message="Loading checklist…" />;
  }

  if (subtasks.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={ListChecks}
          title="No checklist yet"
          description="Add steps for field execution, or apply an org template."
          action={
            canEdit
              ? {
                  label: "Add first item",
                  onClick: () => void handleAddItem(),
                  icon: Plus,
                }
              : undefined
          }
        />
        {canEdit && (
          <div className="flex flex-col gap-2 w-full max-w-xs mx-auto px-4">
            {templates.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full shadow-e1"
                    disabled={templatesLoading || applyingTemplateId !== null}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Use template
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="max-h-64 overflow-y-auto">
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
            <Button
              type="button"
              variant="ghost"
              className="text-sm text-muted-foreground"
              onClick={() => navigate("/manage/templates")}
            >
              Manage checklist templates
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="shadow-e1" onClick={() => void handleAddItem()}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add item
          </Button>
          {templates.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shadow-e1"
                  disabled={applyingTemplateId !== null}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Apply template
                </Button>
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
          )}
        </div>
      )}
      <ul className="space-y-2">
        {subtasks.map((row) => {
          const done = Boolean(row.is_completed || row.completed);
          return (
            <li
              key={row.id}
              className="flex items-start gap-3 rounded-[10px] bg-muted/35 px-3 py-2.5 shadow-none"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
                checked={done}
                disabled={!canEdit}
                onChange={() => void toggleSubtask(row.id)}
                aria-label={`Mark ${row.title} complete`}
              />
              <span
                className={cn(
                  "flex-1 text-sm text-foreground leading-snug",
                  done && "line-through text-muted-foreground"
                )}
              >
                {row.title}
              </span>
              {canEdit && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => void deleteSubtask(row.id)}
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
