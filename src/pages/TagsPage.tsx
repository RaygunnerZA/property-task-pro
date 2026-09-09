import { useMemo, useState } from "react";
import { Tags as TagsIcon, Plus } from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";
import { NeomorphicInput } from "@/components/design-system/NeomorphicInput";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useThemes } from "@/hooks/useThemes";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * Org tags (themes used to classify tasks). Kept intentionally light —
 * create and browse; assignment stays on task surfaces.
 */
export default function TagsPage() {
  const { orgId } = useActiveOrg();
  const { themes, loading, refresh } = useThemes();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const tags = useMemo(
    () =>
      themes.filter((t) => t.type === "category" || t.type === "tag"),
    [themes]
  );

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || !orgId) return;
    setCreating(true);
    try {
      const { error } = await supabase
        .from("themes")
        .insert({ org_id: orgId, name: trimmed, type: "category" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["themes"] });
      await refresh();
      setShowCreate(false);
      setName("");
      toast({ title: "Tag created" });
    } catch (err: unknown) {
      toast({
        title: "Couldn't create tag",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <StandardPage
      title="Tags"
      subtitle="Labels for organising tasks across your properties"
      icon={<TagsIcon className="h-6 w-6" />}
      maxWidth="md"
      action={
        <NeomorphicButton
          type="button"
          onClick={() => setShowCreate(true)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          New tag
        </NeomorphicButton>
      }
    >
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!creating) setShowCreate(open);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Create tag</DialogTitle>
            <DialogDescription>
              Add a label you can attach when creating or editing tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="tag-name">Name</Label>
            <NeomorphicInput
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Urgent follow-up"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <NeomorphicButton
              type="button"
              variant="ghost"
              disabled={creating}
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </NeomorphicButton>
            <NeomorphicButton
              type="button"
              disabled={creating || !name.trim()}
              onClick={() => void handleCreate()}
            >
              {creating ? "Creating…" : "Create"}
            </NeomorphicButton>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <LoadingState message="Loading tags…" />
      ) : tags.length === 0 ? (
        <EmptyState
          icon={TagsIcon}
          title="No tags yet"
          description="Create tags to classify tasks — they show up when you add work."
          action={{
            label: "New tag",
            onClick: () => setShowCreate(true),
            icon: Plus,
          }}
        />
      ) : (
        <ul className="space-y-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className={cn(
                "flex items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-e1"
              )}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{
                  backgroundColor: tag.color || "#8EC9CE",
                }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {tag.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </StandardPage>
  );
}
