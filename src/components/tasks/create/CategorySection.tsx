/**
 * CategorySection - Create Task "Tag" row (single-line, no panel)
 *
 * Behavior:
 * - Hover shows `+ Tag`
 * - Clicking `+ Tag` turns it into an inline input (100→240px)
 * - Typing shows `{+Existing}` category matches from DB
 * - Always offers `{ADD Value}` when no exact match; opens a small create modal prefilled
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useCategories } from "@/hooks/useCategories";
import { supabase } from "@/integrations/supabase/client";
import { SemanticChip } from "@/components/chips/semantic";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INPUT_MIN_WIDTH = 100;
const INPUT_MAX_WIDTH = 240;
const INPUT_CH_WIDTH = 8;

interface CategorySectionProps {
  isActive: boolean;
  onActivate: () => void;
  selectedThemeIds: string[];
  onThemesChange: (themeIds: string[]) => void;
  hasUnresolved?: boolean;
}

function parseGhostCategoryId(id: string): { name: string } | null {
  const match = id.match(/^ghost-theme-(.+?)-category$/);
  if (!match) return null;
  const [, rawName] = match;
  if (!rawName) return null;
  return { name: rawName };
}

export function CategorySection({
  isActive,
  onActivate,
  selectedThemeIds,
  onThemesChange,
  hasUnresolved = false,
}: CategorySectionProps) {
  const { toast } = useToast();
  const { orgId } = useActiveOrg();
  const { categories, refresh } = useCategories();

  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);

  // Close inline editing when row deactivates
  useEffect(() => {
    if (!isActive) {
      setIsEditing(false);
      setQuery("");
      setShowCreate(false);
      setCreateName("");
    }
  }, [isActive]);

  useEffect(() => {
    if (isEditing) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  const selectedCategoryIds = useMemo(
    () => selectedThemeIds.filter((id) => !id.startsWith("ghost-theme-")),
    [selectedThemeIds]
  );
  const selectedGhostCategories = useMemo(
    () =>
      selectedThemeIds
        .filter((id) => id.startsWith("ghost-theme-"))
        .map(parseGhostCategoryId)
        .filter((x): x is { name: string } => !!x),
    [selectedThemeIds]
  );

  const selectedCategories = useMemo(
    () => categories.filter((c) => selectedCategoryIds.includes(c.id)),
    [categories, selectedCategoryIds]
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return categories
      .filter((c) => c.name.toLowerCase().includes(q))
      .filter((c) => !selectedCategoryIds.includes(c.id))
      .slice(0, 4);
  }, [query, categories, selectedCategoryIds]);

  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return (
      categories.some((c) => c.name.toLowerCase() === q) ||
      selectedGhostCategories.some((g) => g.name.toLowerCase() === q)
    );
  }, [query, categories, selectedGhostCategories]);

  const inputWidth = Math.min(
    INPUT_MAX_WIDTH,
    Math.max(INPUT_MIN_WIDTH, (query.length + 2) * INPUT_CH_WIDTH)
  );

  const addCategory = (categoryId: string) => {
    if (selectedThemeIds.includes(categoryId)) return;
    onThemesChange([...selectedThemeIds, categoryId]);
    setIsEditing(false);
    setQuery("");
  };

  const removeThemeId = (id: string) => {
    onThemesChange(selectedThemeIds.filter((x) => x !== id));
  };

  const handleAddTagClick = () => {
    if (!isActive) onActivate();
    setIsEditing(true);
    setQuery("");
  };

  const openCreate = (name: string) => {
    if (!orgId) {
      toast({ title: "Organisation not found", variant: "destructive" });
      return;
    }
    setCreateName(name);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    if (!orgId) {
      toast({ title: "Organisation not found", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("themes")
        .insert({ org_id: orgId, name, type: "category" })
        .select("id")
        .single();
      if (error) throw error;
      if (data?.id) {
        onThemesChange([...selectedThemeIds, data.id]);
      }
      await refresh?.();
      setShowCreate(false);
      setIsEditing(false);
      setQuery("");
      toast({ title: "Tag created" });
    } catch (err: any) {
      toast({ title: "Couldn't create tag", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "flex flex-col rounded-[8px] transition-all duration-200",
        !isActive && "hover:bg-muted/30"
      )}
    >
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!creating) setShowCreate(open);
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
            <DialogDescription>Add a tag to organise tasks.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="create-tag-name">Name</Label>
            <Input
              id="create-tag-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              disabled={creating}
              placeholder="e.g. Maintenance"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !createName.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-2 h-[33px] min-w-0">
        <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-[8px] bg-background">
          <Tag className="h-4 w-4 text-muted-foreground" />
        </div>

        <div
          className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap pr-[6px] pt-[3px] pb-[3px]">
          {/* Fact chips */}
          {selectedCategories.map((c) => (
            <SemanticChip
              key={c.id}
              epistemic="fact"
              label={c.name.toUpperCase()}
              removable
              onRemove={() => removeThemeId(c.id)}
              truncate
              className="shrink-0"
            />
          ))}
          {selectedGhostCategories.map((g) => {
            const id = `ghost-theme-${g.name}-category`;
            return (
              <SemanticChip
                key={id}
                epistemic="fact"
                label={g.name.toUpperCase()}
                removable
                onRemove={() => removeThemeId(id)}
                truncate
                className="shrink-0"
              />
            );
          })}

          {isEditing ? (
            <>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsEditing(false);
                    setQuery("");
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const first = suggestions[0];
                    if (first) addCategory(first.id);
                    else if (query.trim() && !hasExactMatch) openCreate(query.trim());
                  }
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setIsEditing(false);
                    setQuery("");
                  }, 150);
                }}
                placeholder="ADD TAG"
                className={cn(
                  "h-[28px] w-[100px] min-w-[100px] max-w-[240px] rounded-[8px] px-2 py-1 shrink-0 flex-shrink-0",
                  "font-mono text-[11px] uppercase tracking-wide",
                  "bg-background text-muted-foreground/70 placeholder:text-muted-foreground/50",
                  "shadow-inset outline-none cursor-text",
                  "transition-[width] duration-150 ease-out"
                )}
                style={{ width: inputWidth }}
              />

              {suggestions.map((c) => (
                <SemanticChip
                  key={c.id}
                  epistemic="proposal"
                  label={`+${c.name}`.toUpperCase()}
                  onPress={() => addCategory(c.id)}
                  truncate
                  className="shrink-0"
                />
              ))}

              {query.trim() && !hasExactMatch && (
                <SemanticChip
                  epistemic="proposal"
                  label={`ADD ${query.trim()}`.toUpperCase()}
                  onPress={() => openCreate(query.trim())}
                  truncate
                  className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
                />
              )}
            </>
          ) : isHovered ? (
            <SemanticChip
              epistemic="proposal"
              label="+ Tag"
              truncate={false}
              onPress={handleAddTagClick}
              pressOnPointerDown
              className="shrink-0 px-2.5 py-1.5 bg-background shadow-e1"
            />
          ) : null}
          </div>
        </div>

        {hasUnresolved && !isActive && (
          <div className="flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 border border-background" />
        )}
      </div>
    </div>
  );
}

