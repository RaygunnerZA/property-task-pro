import { useMemo, useState } from "react";
import { Tags as TagsIcon, Plus } from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";
import { NeomorphicInput } from "@/components/design-system/NeomorphicInput";
import {
  workbenchAskPlaceholder,
} from "@/components/workbench/WorkbenchCentreSearch";
import {
  PropertyWorkspaceLayout,
  WorkspaceHealthGrid,
  WorkspaceSectionHeading,
  WorkspaceSurfaceCard,
} from "@/components/property-workspace";
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
  const [searchQuery, setSearchQuery] = useState("");

  const tags = useMemo(
    () =>
      themes.filter((t) => t.type === "category" || t.type === "tag"),
    [themes]
  );

  const filteredTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => (t.name ?? "").toLowerCase().includes(q));
  }, [tags, searchQuery]);

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

  const categoryCount = tags.filter((t) => t.type === "category").length;
  const plainTagCount = tags.filter((t) => t.type === "tag").length;
  const newThisMonth = tags.filter((t) => {
    if (!t.created_at) return false;
    return Date.now() - new Date(t.created_at).getTime() < 30 * 24 * 60 * 60 * 1000;
  }).length;
  const recentTags = [...tags]
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    )
    .slice(0, 5);

  const contextColumn = (
    <div className="space-y-4">
      <WorkspaceSurfaceCard
        title="Overview"
        description="How tags organise work across your properties"
      >
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">{tags.length}</span>{" "}
            tag{tags.length === 1 ? "" : "s"} in your organisation
          </li>
          <li>
            Attach tags when creating or editing tasks to group related work.
          </li>
        </ul>
      </WorkspaceSurfaceCard>

      <WorkspaceSurfaceCard
        title="Tag Health"
        description="Your labels at a glance"
      >
        <WorkspaceHealthGrid
          stats={[
            { label: "Total", value: tags.length },
            { label: "Categories", value: categoryCount },
            { label: "Tags", value: plainTagCount },
            {
              label: "New 30d",
              value: newThisMonth,
              color: "rgba(16, 185, 129, 1)",
            },
          ]}
        />
      </WorkspaceSurfaceCard>

      <div className="overflow-hidden rounded-xl bg-card/60 p-3 shadow-e1">
        <WorkspaceSectionHeading>Recent tags</WorkspaceSectionHeading>
        {recentTags.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            New tags appear here.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {recentTags.map((tag) => (
              <li
                key={tag.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color || "#8EC9CE" }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {tag.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const workColumn = (
    <>
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
      ) : filteredTags.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No tags match your search.
        </p>
      ) : (
        <ul className="space-y-2">
          {filteredTags.map((tag) => (
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
    </>
  );

  return (
    <StandardPage
      title="Tags"
      subtitle="Labels for organising tasks across your properties"
      icon={<TagsIcon className="h-6 w-6" />}
      maxWidth="full"
      contentClassName="max-w-[1480px]"
      hideTitle
      hideHeaderSearch
      headerVariant="activity"
    >
      <PropertyWorkspaceLayout
        pageTitle="Tags"
        pageSubtitle="Labels for organising tasks across your properties"
        pageIcon={<TagsIcon />}
        pageTitleAction={
          <NeomorphicButton
            type="button"
            onClick={() => setShowCreate(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New tag
          </NeomorphicButton>
        }
        searchPlaceholder={workbenchAskPlaceholder("Tags")}
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        contextColumn={contextColumn}
        workColumn={workColumn}
        actionColumn={null}
      />
    </StandardPage>
  );
}
