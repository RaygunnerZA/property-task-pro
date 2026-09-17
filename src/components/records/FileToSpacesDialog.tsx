import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  partitionPropertySpaces,
  toOnboardingAreas,
  type SpaceLike,
} from "@/lib/spaces/partitionPropertySpaces";

type FileToSpacesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentTitle: string;
  spaces: SpaceLike[];
  /** Currently linked space ids (single-doc reconcile mode). */
  linkedSpaceIds: string[];
  /**
   * reconcile — set exact links for one document.
   * add — add chosen spaces onto selection without removing existing (bulk).
   */
  mode?: "reconcile" | "add";
  onSave: (selectedSpaceIds: string[]) => Promise<void> | void;
};

/**
 * Multi-select File to… picker — property level + areas with nested rooms.
 */
export function FileToSpacesDialog({
  open,
  onOpenChange,
  documentTitle,
  spaces,
  linkedSpaceIds,
  mode = "reconcile",
  onSave,
}: FileToSpacesDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(linkedSpaceIds));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(mode === "add" ? new Set() : new Set(linkedSpaceIds));
    }
  }, [open, linkedSpaceIds, mode]);

  const { areas, roomsByAreaId, unassigned } = useMemo(
    () => partitionPropertySpaces(spaces),
    [spaces]
  );
  const onboardingAreas = useMemo(() => toOnboardingAreas(areas), [areas]);

  const toggle = (spaceId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave([...selected]);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-hidden sm:rounded-card">
        <DialogHeader>
          <DialogTitle className="text-base">File to spaces</DialogTitle>
          <p className="truncate text-xs text-muted-foreground" title={documentTitle}>
            {documentTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {mode === "add"
              ? "Choose spaces to add. Existing location labels stay."
              : "Select one or more spaces. Leave none selected to keep at property level."}
          </p>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {mode === "reconcile" ? (
            <div
              className={cn(
                "rounded-lg px-2.5 py-2 text-sm",
                selected.size === 0
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground"
              )}
            >
              Property level
              {selected.size === 0 ? (
                <span className="ml-2 font-mono text-2xs uppercase text-primary">
                  Current
                </span>
              ) : null}
            </div>
          ) : null}

          {onboardingAreas.map((area) => {
            const rooms = roomsByAreaId[area.id] ?? [];
            if (rooms.length === 0) return null;
            return (
              <div key={area.id} className="space-y-1">
                <p
                  className="font-mono text-2xs uppercase tracking-wide"
                  style={{ color: area.color }}
                >
                  {area.name}
                </p>
                <ul className="space-y-0.5 pl-2">
                  {rooms.map((room) => {
                    const name = (room.name ?? "").trim() || "Space";
                    const checked = selected.has(room.id);
                    return (
                      <li key={room.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggle(room.id)}
                            aria-label={`File to ${name}`}
                          />
                          <span className="min-w-0 truncate">{name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {unassigned.length > 0 ? (
            <div className="space-y-1">
              <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
                Other spaces
              </p>
              <ul className="space-y-0.5 pl-2">
                {unassigned.map((room) => {
                  const name = (room.name ?? "").trim() || "Space";
                  const checked = selected.has(room.id);
                  return (
                    <li key={room.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(room.id)}
                          aria-label={`File to ${name}`}
                        />
                        <span className="min-w-0 truncate">{name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {spaces.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No spaces yet. Add rooms on the Spaces screen first.
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || (mode === "add" && selected.size === 0)}
          >
            {saving ? "Saving…" : mode === "add" ? "Add locations" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
