import { useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ExpandableSpaceChip } from "@/components/chips/semantic";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import type { GroupExtraSpace, OnboardingCustomCollection } from "./onboardingSpaceGroups";
import { CUSTOM_COLLECTION_DESCRIPTION, shortSpaceLabel } from "./onboardingSpaceGroups";
import { SpaceGroupCardBanner } from "@/components/spaces/SpaceGroupCardBanner";
import { getSpaceGroupCardIllustration } from "@/lib/spaceGroupIllustrations";
import {
  SPACE_GROUP_ADD_INPUT_CLASS,
  SPACE_GROUP_ADD_INPUT_SHADOW,
} from "./spaceGroupCardInputStyles";
import { resizeImageForCardBanner } from "@/utils/image-optimization";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";

const HOVER_EXPAND_DELAY_MS = 450;
const EXPAND_DURATION_MS = 350;
const COLLAPSE_DURATION_MS = 450;
const BANNER_HEIGHT_PX = 130;
const BANNER_COLLAPSED_HEIGHT_PX = 70;

const SELECTED_CHIP_TEAL = "#85BABC";

const DASHED_LINE_STYLE = {
  height: "1px",
  backgroundImage:
    "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
  backgroundSize: "7px 1px",
  backgroundRepeat: "repeat-x" as const,
};

const INLINE_INPUT_CLASS = cn(SPACE_GROUP_ADD_INPUT_CLASS, "h-[34px]");
const INLINE_INPUT_SHADOW = SPACE_GROUP_ADD_INPUT_SHADOW;

const MAX_BANNER_BYTES = 10 * 1024 * 1024;

interface OnboardingCustomCollectionCardProps {
  collection: OnboardingCustomCollection;
  selectedSpacesSet: Set<string>;
  extraSpaces?: GroupExtraSpace[];
  subSpacesByParent?: Record<string, string[]>;
  onAddSpace: (name: string, extra?: boolean) => void;
  onRemoveSpace?: (name: string) => void;
  onRenameSpace?: (name: string) => void;
  onCopySpace?: (name: string, groupId: string) => void;
  onAddSubSpace?: (parentSpace: string, subSpaceName: string) => void;
  onUpdateCollection: (id: string, updates: { name?: string; imageSrc?: string }) => void;
  className?: string;
}

export function OnboardingCustomCollectionCard({
  collection,
  selectedSpacesSet,
  extraSpaces = [],
  subSpacesByParent = {},
  onAddSpace,
  onRemoveSpace,
  onRenameSpace,
  onCopySpace,
  onAddSubSpace,
  onUpdateCollection,
  className,
}: OnboardingCustomCollectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [transitionMs, setTransitionMs] = useState(EXPAND_DURATION_MS);
  const [spaceName, setSpaceName] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const [editImagePreview, setEditImagePreview] = useState<string | undefined>(
    collection.imageSrc
  );
  const [isResizingImage, setIsResizingImage] = useState(false);
  const enterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressHoverExpandRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRevokeRef = useRef<string | null>(null);

  const bannerSrc =
    collection.imageSrc ?? getSpaceGroupCardIllustration("custom");

  const handleMouseEnter = useCallback(() => {
    if (suppressHoverExpandRef.current) return;
    if (enterTimeoutRef.current) return;
    enterTimeoutRef.current = setTimeout(() => {
      enterTimeoutRef.current = null;
      setTransitionMs(EXPAND_DURATION_MS);
      setIsExpanded(true);
    }, HOVER_EXPAND_DELAY_MS);
  }, []);

  const handleMouseLeave = useCallback(() => {
    suppressHoverExpandRef.current = false;
    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }
  }, []);

  const handleBannerClick = useCallback(() => {
    if (!isExpanded) return;
    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }
    suppressHoverExpandRef.current = true;
    setTransitionMs(COLLAPSE_DURATION_MS);
    setIsExpanded(false);
  }, [isExpanded]);

  const visibleSpaceNames = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();

    for (const extra of extraSpaces) {
      const extraName =
        typeof extra === "string"
          ? extra
          : typeof extra?.name === "string"
            ? extra.name
            : null;
      if (!extraName?.trim()) continue;
      const key = extraName.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      if (extra.insertAfter) {
        const afterKey = extra.insertAfter.toLowerCase().trim();
        const afterIdx = names.findIndex((n) => n.toLowerCase().trim() === afterKey);
        if (afterIdx >= 0) {
          names.splice(afterIdx + 1, 0, extraName);
          continue;
        }
      }
      names.push(extraName);
    }

    return names;
  }, [extraSpaces]);

  const handleAddSpace = () => {
    const trimmed = spaceName.trim();
    if (!trimmed) return;
    if (selectedSpacesSet.has(trimmed.toLowerCase().trim())) {
      toast.error("Space already added");
      return;
    }
    onAddSpace(trimmed, true);
    setSpaceName("");
  };

  const openEditDialog = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(collection.name);
    setEditImagePreview(collection.imageSrc);
    pendingRevokeRef.current = null;
    setEditOpen(true);
  };

  const closeEditDialog = () => {
    if (pendingRevokeRef.current) {
      URL.revokeObjectURL(pendingRevokeRef.current);
      pendingRevokeRef.current = null;
    }
    setEditOpen(false);
    setIsResizingImage(false);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_BANNER_BYTES) {
      toast.error("Image must be 10MB or smaller");
      return;
    }

    setIsResizingImage(true);
    try {
      const resizedUrl = await resizeImageForCardBanner(file);
      if (pendingRevokeRef.current) {
        URL.revokeObjectURL(pendingRevokeRef.current);
      }
      pendingRevokeRef.current = resizedUrl;
      setEditImagePreview(resizedUrl);
    } catch {
      toast.error("Could not process image");
    } finally {
      setIsResizingImage(false);
    }
  };

  const confirmEdit = () => {
    const trimmed = editName.trim();
    if (!trimmed) return;

    const updates: { name?: string; imageSrc?: string } = { name: trimmed };
    if (editImagePreview && editImagePreview !== collection.imageSrc) {
      updates.imageSrc = editImagePreview;
      pendingRevokeRef.current = null;
    }

    onUpdateCollection(collection.id, updates);
    closeEditDialog();
  };

  const transitionStyle = { transitionDuration: `${transitionMs}ms` };

  return (
    <>
      <div
        className={cn("w-[200px] h-[272px] flex-shrink-0", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-[8px] bg-card shadow-e1">
          <div
            role={isExpanded ? "button" : undefined}
            tabIndex={isExpanded ? 0 : undefined}
            aria-label={isExpanded ? `Collapse ${collection.name}` : undefined}
            onClick={isExpanded ? handleBannerClick : undefined}
            onKeyDown={
              isExpanded
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleBannerClick();
                    }
                  }
                : undefined
            }
            className={cn(
              "relative shrink-0 overflow-hidden transition-all ease-out",
              isExpanded && "cursor-pointer"
            )}
            style={{
              ...transitionStyle,
              height: isExpanded ? BANNER_COLLAPSED_HEIGHT_PX : BANNER_HEIGHT_PX,
            }}
          >
            <SpaceGroupCardBanner
              imageSrc={bannerSrc}
              alt={collection.name}
              color="#E8DFD0"
              className="h-full"
            />
            <button
              type="button"
              onClick={openEditDialog}
              className={cn(
                "absolute top-1.5 right-1.5 z-10 flex h-7 w-7 items-center justify-center",
                "rounded-md bg-white/90 text-[#6D7480] shadow-sm",
                "transition-colors hover:bg-white hover:text-foreground"
              )}
              aria-label={`Edit ${collection.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-2">
            <div className="shrink-0 space-y-2 transition-transform ease-out" style={transitionStyle}>
              <h3 className="text-lg font-semibold leading-tight text-foreground line-clamp-1">
                {collection.name}
              </h3>
              <div className="-ml-1 -mr-1 pt-1" style={DASHED_LINE_STYLE} />
            </div>

            <p
              className={cn(
                "mt-[5px] text-xs leading-[18px] text-muted-foreground transition-all ease-out",
                isExpanded
                  ? "pointer-events-none max-h-0 overflow-hidden opacity-0"
                  : "line-clamp-4 h-[72px] max-h-24 opacity-100"
              )}
              style={transitionStyle}
            >
              {CUSTOM_COLLECTION_DESCRIPTION}
            </p>

            <div
              className={cn(
                "flex flex-wrap content-start items-start gap-x-1.5 gap-y-1 transition-all ease-out",
                isExpanded
                  ? "mt-[6px] min-h-0 flex-1 overflow-auto opacity-100 translate-y-0"
                  : "pointer-events-none max-h-0 overflow-hidden opacity-0 translate-y-3"
              )}
              style={transitionStyle}
            >
              {visibleSpaceNames.length === 0 ? (
                <p className="py-1 text-[10px] font-mono uppercase tracking-wide text-muted-foreground/50">
                  No spaces yet
                </p>
              ) : (
                visibleSpaceNames.map((name) => {
                  const key = name.toLowerCase().trim();
                  return (
                    <ExpandableSpaceChip
                      key={name}
                      label={shortSpaceLabel(name)}
                      color={SELECTED_CHIP_TEAL}
                      subSpaces={subSpacesByParent[key] ?? []}
                      onRemove={() => onRemoveSpace?.(name)}
                      onAddSubSpace={(subName) => onAddSubSpace?.(name, subName)}
                      onRename={onRenameSpace ? () => onRenameSpace(name) : undefined}
                      onDuplicate={
                        onCopySpace
                          ? () => onCopySpace(name, collection.id)
                          : undefined
                      }
                      className="!shadow-sm"
                    />
                  );
                })
              )}
            </div>

            <div
              className={cn(
                "mt-auto flex w-full shrink-0 items-center gap-1.5 pt-1 transition-all ease-out",
                isExpanded
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none max-h-0 overflow-hidden pt-0 opacity-0 translate-y-2"
              )}
              style={transitionStyle}
            >
              <input
                type="text"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSpace();
                  }
                }}
                placeholder="Add space"
                className={INLINE_INPUT_CLASS}
                style={INLINE_INPUT_SHADOW}
              />
              <button
                type="button"
                onClick={handleAddSpace}
                disabled={!spaceName.trim()}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-all",
                  "disabled:opacity-50"
                )}
                style={{ backgroundColor: "#14B8A6" }}
                aria-label="Add space"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-sm gap-3 p-4" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base font-mono uppercase tracking-wide">
              Edit collection
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wide text-muted-foreground">
                Collection name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Collection name"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wide text-muted-foreground">
                Card image
              </label>
              <div className="relative h-[80px] overflow-hidden rounded-lg bg-muted">
                <img
                  src={editImagePreview ?? getSpaceGroupCardIllustration("custom")}
                  alt=""
                  className="h-full w-full object-cover object-center"
                />
                {isResizingImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isResizingImage}
                className="mt-2 text-xs font-mono uppercase tracking-wide text-[#8EC9CE] hover:underline disabled:opacity-50"
              >
                Upload new image
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <NeomorphicButton variant="ghost" onClick={closeEditDialog}>
              Cancel
            </NeomorphicButton>
            <NeomorphicButton
              variant="primary"
              onClick={confirmEdit}
              disabled={!editName.trim() || isResizingImage}
              style={{ backgroundColor: "#8EC9CE" }}
            >
              Save
            </NeomorphicButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
