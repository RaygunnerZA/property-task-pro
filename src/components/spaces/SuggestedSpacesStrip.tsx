/**
 * Horizontal strip of "suggested" space mini cards for a space group.
 * Cards render muted/ghosted until clicked, at which point a real Space
 * is created and the card becomes fully active with an edit menu.
 */
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { resolveToCanonicalSpaceType } from "@/config/spaceTypeAliases";
import { getAssetIcon } from "@/lib/icon-resolver";
import { AIIconColorPicker } from "@/components/ui/AIIconColorPicker";
import { ONBOARDING_SPACE_GROUPS } from "@/components/onboarding/onboardingSpaceGroups";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Check,
  Pencil,
  Type,
  Copy,
  Trash2,
  Archive,
  Palette,
  Plus,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivatedSpace = {
  id: string;
  name: string;
  icon_name: string | null;
  space_type_id: string | null;
};

type EditActionType = "rename" | "icon" | "sub-space" | "move";

type SpaceTypeRow = {
  id: string;
  name: string;
  default_icon: string | null;
  default_ui_group: string | null;
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface SuggestedSpacesStripProps {
  suggestedSpaces: string[];
  groupColor: string;
  propertyId: string;
  onSpaceAdded?: () => void;
  onSpaceOpen?: (spaceId: string) => void;
}

export function SuggestedSpacesStrip({
  suggestedSpaces,
  groupColor,
  propertyId,
  onSpaceAdded,
  onSpaceOpen,
}: SuggestedSpacesStripProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();

  const [activating, setActivating] = useState<string | null>(null);
  const [localAdded, setLocalAdded] = useState<Map<string, ActivatedSpace>>(
    new Map()
  );
  const [editAction, setEditAction] = useState<{
    type: EditActionType;
    space: ActivatedSpace;
  } | null>(null);
  const [dialogInput, setDialogInput] = useState("");
  const [iconValue, setIconValue] = useState({ iconName: "box", color: "#8EC9CE" });
  const [iconPreviewSpace, setIconPreviewSpace] = useState<string | null>(null);
  const [iconPreviewValue, setIconPreviewValue] = useState({ iconName: "box", color: "#8EC9CE" });
  const [preferredIcons, setPreferredIcons] = useState<Map<string, string>>(new Map());

  // ---- Queries ----

  // All space_types — small reference table, fetched once
  const { data: allSpaceTypes = [] } = useQuery<SpaceTypeRow[]>({
    queryKey: ["space-types", "all-with-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("space_types")
        .select("id, name, default_icon, default_ui_group");
      if (error || !data) return [];
      return data as SpaceTypeRow[];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Existing spaces for this property
  const { data: existingSpaces = [], refetch: refetchSpaces } = useQuery({
    queryKey: ["spaces", "property-suggested", orgId, propertyId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("spaces")
        .select("id, name, icon_name, space_type_id")
        .eq("org_id", orgId)
        .eq("property_id", propertyId);
      if (error || !data) return [];
      return data as ActivatedSpace[];
    },
    enabled: !!orgId && !!propertyId,
  });

  // ---- Derived data ----

  const spaceTypeMap = useMemo(() => {
    const map: Record<string, { icon: string | null; typeId: string }> = {};
    allSpaceTypes.forEach((row) => {
      map[row.name.toLowerCase()] = { icon: row.default_icon, typeId: row.id };
    });
    return map;
  }, [allSpaceTypes]);

  const typesByGroup = useMemo(() => {
    const map: Record<string, SpaceTypeRow[]> = {};
    allSpaceTypes.forEach((row) => {
      if (row.default_ui_group) {
        if (!map[row.default_ui_group]) map[row.default_ui_group] = [];
        map[row.default_ui_group].push(row);
      }
    });
    return map;
  }, [allSpaceTypes]);

  const existingMap = useMemo(() => {
    const map = new Map<string, ActivatedSpace>();
    existingSpaces.forEach((s) => {
      if (s.name) map.set(s.name.toLowerCase().trim(), s);
    });
    return map;
  }, [existingSpaces]);

  const getActivatedSpace = (name: string): ActivatedSpace | null => {
    const key = name.toLowerCase().trim();
    return localAdded.get(key) ?? existingMap.get(key) ?? null;
  };

  // ---- Helpers ----

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["spaces"] });
    refetchSpaces();
  };

  const resolveIconAndType = (spaceName: string) => {
    const canonical = resolveToCanonicalSpaceType(spaceName) ?? spaceName;
    const match = spaceTypeMap[canonical.toLowerCase()];
    return {
      iconName: match?.icon ?? "box",
      typeId: match?.typeId ?? null,
    };
  };

  // ---- Action handlers ----

  const handleActivate = async (spaceName: string) => {
    if (!orgId || !propertyId) return;
    if (getActivatedSpace(spaceName)) return;

    setActivating(spaceName);
    try {
      const preferred = preferredIcons.get(spaceName.toLowerCase().trim());
      const { iconName, typeId } = resolveIconAndType(spaceName);
      const iconToUse = preferred ?? iconName;
      const insert: Record<string, unknown> = {
        name: spaceName,
        org_id: orgId,
        property_id: propertyId,
        icon_name: iconToUse,
      };
      if (typeId) insert.space_type_id = typeId;

      const { data, error } = await supabase
        .from("spaces")
        .insert(insert)
        .select("id, name, icon_name, space_type_id")
        .single();
      if (error) throw error;

      const created = data as ActivatedSpace;
      setLocalAdded((prev) => {
        const next = new Map(prev);
        next.set(created.name.toLowerCase().trim(), created);
        return next;
      });
      toast.success(`${spaceName} added`);
      invalidateAll();
      onSpaceAdded?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to add space");
    } finally {
      setActivating(null);
    }
  };

  const openEdit = (type: EditActionType, space: ActivatedSpace) => {
    setEditAction({ type, space });
    if (type === "rename") setDialogInput(space.name);
    if (type === "sub-space") setDialogInput("");
    if (type === "icon")
      setIconValue({ iconName: space.icon_name || "box", color: groupColor });
  };

  const openIconPreview = (spaceName: string) => {
    const { iconName } = resolveIconAndType(spaceName);
    const preferred = preferredIcons.get(spaceName.toLowerCase().trim());
    setIconPreviewSpace(spaceName);
    setIconPreviewValue({
      iconName: preferred ?? iconName,
      color: groupColor,
    });
  };

  const closeIconPreview = () => setIconPreviewSpace(null);

  const handleIconPreviewSave = () => {
    if (!iconPreviewSpace) return;
    setPreferredIcons((prev) => {
      const next = new Map(prev);
      next.set(iconPreviewSpace.toLowerCase().trim(), iconPreviewValue.iconName);
      return next;
    });
    toast.success("Icon updated");
    closeIconPreview();
  };

  const closeDialog = () => setEditAction(null);

  const handleRename = async () => {
    if (!editAction) return;
    const newName = dialogInput.trim();
    if (!newName) return;
    try {
      const { error } = await supabase
        .from("spaces")
        .update({ name: newName })
        .eq("id", editAction.space.id);
      if (error) throw error;
      toast.success(`Renamed to ${newName}`);
      invalidateAll();
      closeDialog();
    } catch (err: any) {
      toast.error(err.message || "Failed to rename");
    }
  };

  const handleDuplicate = async (space: ActivatedSpace) => {
    if (!orgId || !propertyId) return;
    const allNames = new Set([
      ...existingSpaces.map((s) => s.name.toLowerCase()),
      ...[...localAdded.values()].map((s) => s.name.toLowerCase()),
    ]);
    let num = 2;
    while (allNames.has(`${space.name.toLowerCase()} ${num}`)) num++;
    const newName = `${space.name} ${num}`;
    try {
      const { error } = await supabase.from("spaces").insert({
        name: newName,
        org_id: orgId,
        property_id: propertyId,
        icon_name: space.icon_name,
        space_type_id: space.space_type_id,
      });
      if (error) throw error;
      toast.success(`${newName} created`);
      invalidateAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate");
    }
  };

  const handleDelete = async (space: ActivatedSpace) => {
    try {
      const { error } = await supabase
        .from("spaces")
        .delete()
        .eq("id", space.id);
      if (error) throw error;
      setLocalAdded((prev) => {
        const next = new Map(prev);
        next.delete(space.name.toLowerCase().trim());
        return next;
      });
      toast.success(`${space.name} removed`);
      invalidateAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleIconSave = async () => {
    if (!editAction) return;
    try {
      const { error } = await supabase
        .from("spaces")
        .update({ icon_name: iconValue.iconName })
        .eq("id", editAction.space.id);
      if (error) throw error;
      toast.success("Icon updated");
      invalidateAll();
      closeDialog();
    } catch (err: any) {
      toast.error(err.message || "Failed to update icon");
    }
  };

  const handleAddSubSpace = async () => {
    if (!editAction || !orgId || !propertyId) return;
    const subName = dialogInput.trim();
    if (!subName) return;
    try {
      const { iconName, typeId } = resolveIconAndType(subName);
      const insert: Record<string, unknown> = {
        name: subName,
        org_id: orgId,
        property_id: propertyId,
        icon_name: iconName,
      };
      if (typeId) insert.space_type_id = typeId;

      const { error } = await supabase.from("spaces").insert(insert);
      if (error) throw error;
      toast.success(`${subName} added`);
      invalidateAll();
      closeDialog();
    } catch (err: any) {
      toast.error(err.message || "Failed to add sub-space");
    }
  };

  const handleMoveToGroup = async (targetLabel: string) => {
    if (!editAction) return;
    const candidates = typesByGroup[targetLabel];
    if (!candidates?.length) {
      toast.error("No space types in that group");
      return;
    }
    const match =
      candidates.find(
        (t) => t.name.toLowerCase() === editAction.space.name.toLowerCase()
      ) ?? candidates[0];
    try {
      const { error } = await supabase
        .from("spaces")
        .update({ space_type_id: match.id, icon_name: match.default_icon })
        .eq("id", editAction.space.id);
      if (error) throw error;
      toast.success(`Moved to ${targetLabel}`);
      invalidateAll();
      closeDialog();
    } catch (err: any) {
      toast.error(err.message || "Failed to move");
    }
  };

  // ---- Derived lists ----

  const mySpaces = suggestedSpaces
    .map((name) => ({ name, space: getActivatedSpace(name) }))
    .filter((s): s is { name: string; space: ActivatedSpace } => !!s.space);

  const unactivated = suggestedSpaces.filter((name) => !getActivatedSpace(name));

  // ---- Render ----

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* My Spaces — activated cards */}
      {mySpaces.length > 0 && (
        <div>
          <PanelSectionTitle as="h3">My Spaces</PanelSectionTitle>
          <div className="overflow-x-auto pb-2 scrollbar-hz-teal">
            <div
              className="flex gap-2.5 h-[165px]"
              style={{ width: "max-content" }}
            >
              {mySpaces.map(({ name, space }) => (
                <SuggestedSpaceCard
                  key={name}
                  name={space.name}
                  iconName={space.icon_name}
                  groupColor={groupColor}
                  isActivated
                  isActivating={false}
                  onActivate={() => {}}
                  onOpen={() => onSpaceOpen?.(space.id)}
                  onEdit={(type) => openEdit(type, space)}
                  onSwatchClick={() => openEdit("icon", space)}
                  onDuplicate={() => handleDuplicate(space)}
                  onDelete={() => handleDelete(space)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Suggested Spaces — only unactivated cards */}
      {unactivated.length > 0 && (
        <div>
          <PanelSectionTitle as="h3">Suggested Spaces</PanelSectionTitle>
          <div className="overflow-x-auto pb-2 scrollbar-hz-teal">
            <div
              className="flex gap-2.5 h-[165px]"
              style={{ width: "max-content" }}
            >
              {unactivated.map((name) => {
                const { iconName } = resolveIconAndType(name);
                const preferredIcon = preferredIcons.get(name.toLowerCase().trim());
                return (
                  <SuggestedSpaceCard
                    key={name}
                    name={name}
                    iconName={preferredIcon ?? iconName}
                    groupColor={groupColor}
                    isActivated={false}
                    isActivating={activating === name}
                    onActivate={() => handleActivate(name)}
                    onSwatchClick={() => openIconPreview(name)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---- Edit dialogs ---- */}
      <Dialog open={!!editAction} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-sm p-5" aria-describedby={undefined}>
          {editAction?.type === "rename" && (
            <>
              <DialogHeader>
                <DialogTitle>Rename Space</DialogTitle>
                <DialogDescription className="sr-only">
                  Change the name of this space
                </DialogDescription>
              </DialogHeader>
              <Input
                value={dialogInput}
                onChange={(e) => setDialogInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                autoFocus
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={handleRename} disabled={!dialogInput.trim()}>
                  Save
                </Button>
              </DialogFooter>
            </>
          )}

          {editAction?.type === "icon" && (
            <>
              <DialogHeader>
                <DialogTitle>Change Icon</DialogTitle>
                <DialogDescription id="icon-edit-desc">
                  Pick a new icon for <strong>{editAction.space.name}</strong>
                </DialogDescription>
              </DialogHeader>
              <AIIconColorPicker
                searchText={editAction.space.name}
                value={iconValue}
                onChange={(icon, color) => setIconValue({ iconName: icon, color })}
                suggestedIcon={editAction.space.icon_name}
                showSearchInput
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={handleIconSave}>Save</Button>
              </DialogFooter>
            </>
          )}

          {editAction?.type === "sub-space" && (
            <>
              <DialogHeader>
                <DialogTitle>Add Sub-Space</DialogTitle>
                <DialogDescription className="sr-only">
                  Create a new space under {editAction.space.name}
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder={`e.g. ${editAction.space.name} 2`}
                value={dialogInput}
                onChange={(e) => setDialogInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubSpace()}
                autoFocus
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={handleAddSubSpace} disabled={!dialogInput.trim()}>
                  Add
                </Button>
              </DialogFooter>
            </>
          )}

          {editAction?.type === "move" && (
            <>
              <DialogHeader>
                <DialogTitle>Move to Group</DialogTitle>
                <DialogDescription className="sr-only">
                  Move {editAction.space.name} to another space group
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-2 py-2">
                {ONBOARDING_SPACE_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => handleMoveToGroup(g.label)}
                    className={cn(
                      "flex items-center gap-2 rounded-[8px] px-3 py-2.5 text-left text-sm font-medium",
                      "transition-all shadow-e1 hover:shadow-md active:scale-[0.98]"
                    )}
                    style={{ borderLeft: `3px solid ${g.color}` }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={closeDialog}>
                  Cancel
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Icon modal for unactivated suggested spaces (swatch click) */}
      <Dialog open={!!iconPreviewSpace} onOpenChange={(open) => !open && closeIconPreview()}>
        <DialogContent className="max-w-sm p-5" aria-describedby={iconPreviewSpace ? "icon-preview-desc" : undefined}>
          <DialogHeader>
            <DialogTitle>Change Icon</DialogTitle>
            <DialogDescription id="icon-preview-desc">
              Pick an icon for <strong>{iconPreviewSpace}</strong>. Use the search field or refresh to get new suggestions.
            </DialogDescription>
          </DialogHeader>
          {iconPreviewSpace && (
            <div className="space-y-4">
              <AIIconColorPicker
                searchText={iconPreviewSpace}
                value={iconPreviewValue}
                onChange={(icon, color) =>
                  setIconPreviewValue({ iconName: icon, color })
                }
                suggestedIcon={resolveIconAndType(iconPreviewSpace).iconName}
                showSearchInput
              />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={closeIconPreview}>
              Cancel
            </Button>
            <Button onClick={handleIconPreviewSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual card
// ---------------------------------------------------------------------------

function SuggestedSpaceCard({
  name,
  iconName,
  groupColor,
  isActivated,
  isActivating,
  onActivate,
  onOpen,
  onEdit,
  onSwatchClick,
  onDuplicate,
  onDelete,
}: {
  name: string;
  iconName: string | null;
  groupColor: string;
  isActivated: boolean;
  isActivating: boolean;
  onActivate: () => void;
  onOpen?: () => void;
  onEdit?: (type: EditActionType) => void;
  onSwatchClick?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const SpaceIcon = getAssetIcon(iconName);

  return (
    <div className="w-[120px] flex-shrink-0 rounded-[5px]">
      <div
        className={cn(
          "bg-card/60 rounded-[8px] overflow-hidden shadow-e1 h-[155px]",
          "transition-all duration-300",
          isActivated
            ? "opacity-100"
            : "opacity-40 grayscale cursor-pointer hover:opacity-70 hover:grayscale-0 active:scale-[0.97]",
          isActivating && "animate-pulse pointer-events-none"
        )}
        onClick={
          isActivated
            ? onOpen
            : !isActivating
              ? onActivate
              : undefined
        }
      >
        {/* Colour header */}
        <div
          className="w-full h-[63px] overflow-hidden relative"
          style={{ backgroundColor: groupColor }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSwatchClick?.();
            }}
            className="absolute top-2 left-2 rounded-[5px] flex items-center justify-center z-10 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
            style={{
              backgroundColor: groupColor,
              width: "24px",
              height: "24px",
              boxShadow:
                "2px 2px 4px rgba(0,0,0,0.1), -1px -1px 2px rgba(255,255,255,0.3)",
            }}
            title="Change icon"
          >
            <SpaceIcon className="h-4 w-4 text-white" />
          </button>

          {isActivated && (
            <div className="absolute top-2 right-2 rounded-full bg-white/90 p-0.5 shadow-sm z-10">
              <Check className="h-3 w-3 text-primary" />
            </div>
          )}

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow:
                "inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 3px 0px 6px rgba(0, 0, 0, 0.15)",
            }}
          />
        </div>

        {/* Body */}
        <div className="pt-2.5 pb-2.5 pl-2.5 pr-2.5 space-y-2 h-[96px]">
          <div
            className="mb-[22px] mt-[4px] h-[15px] flex flex-col justify-center items-start"
            style={{ verticalAlign: "middle" }}
          >
            <h3
              className="font-semibold text-sm text-foreground leading-tight h-[16px]"
              style={{ verticalAlign: "middle", lineHeight: "15px" }}
            >
              {name}
            </h3>
          </div>

          {/* Perforation line */}
          <div
            className="-ml-2.5 -mr-2.5 pt-0 pb-0 px-1"
            style={{
              height: "1px",
              backgroundImage:
                "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
              backgroundSize: "7px 1px",
              backgroundRepeat: "repeat-x",
              boxShadow:
                "1px 1px 0px rgba(255, 255, 255, 1), -1px -1px 1px rgba(0, 0, 0, 0.075)",
            }}
          />

          {/* Status row */}
          <div className="m-0">
            <div className="flex items-center justify-between mt-0 pt-[3px]">
              {isActivated ? (
                <>
                  <span className="text-xs text-primary flex items-center gap-1 font-medium">
                    <Check className="h-3 w-3" />
                    Added
                  </span>
                  {onEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="p-0.5 rounded hover:bg-muted/60 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => onEdit("rename")}>
                          <Type className="h-3.5 w-3.5 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit("icon")}>
                          <Palette className="h-3.5 w-3.5 mr-2" />
                          Change Icon
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate?.()}>
                          <Copy className="h-3.5 w-3.5 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit("sub-space")}>
                          <Plus className="h-3.5 w-3.5 mr-2" />
                          Add Sub-Space
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onEdit("move")}>
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-2" />
                          Move to Group
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDelete?.()} className="text-destructive">
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete?.()} className="text-muted-foreground">
                          <Archive className="h-3.5 w-3.5 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Tap to add
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
