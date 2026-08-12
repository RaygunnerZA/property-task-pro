import { useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ExpandableAssetChip } from "@/components/chips/semantic";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import type {
  GroupExtraAsset,
  OnboardingAssetCustomCollection,
} from "./onboardingAssetGroups";
import {
  CUSTOM_ASSET_COLLECTION_DESCRIPTION,
} from "./onboardingAssetGroups";
import { SpaceGroupCardBanner } from "@/components/spaces/SpaceGroupCardBanner";
import { getAssetGroupCardIllustration } from "@/lib/assetGroupIllustrations";
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
const SELECTED_CHIP_TEAL = "hsl(var(--primary-deep))";

const DASHED_LINE_STYLE = {
  height: "1px",
  backgroundImage:
    "repeating-linear-gradient(to right, hsl(var(--border)) 0px, hsl(var(--border)) 4px, transparent 4px, transparent 7px)",
  backgroundSize: "7px 1px",
  backgroundRepeat: "repeat-x" as const,
};

const INLINE_INPUT_CLASS = cn(SPACE_GROUP_ADD_INPUT_CLASS, "h-[34px]");
const INLINE_INPUT_SHADOW = SPACE_GROUP_ADD_INPUT_SHADOW;
const MAX_BANNER_BYTES = 10 * 1024 * 1024;

interface OnboardingAssetCustomCollectionCardProps {
  collection: OnboardingAssetCustomCollection;
  selectedAssetsSet: Set<string>;
  extraAssets?: GroupExtraAsset[];
  assetFilter?: string;
  onAddAsset: (name: string, extra?: boolean) => void;
  onRemoveAsset?: (name: string) => void;
  onRenameAsset?: (name: string, groupId: string) => void;
  onViewAsset?: (name: string, groupId: string) => void;
  viewAssetByNameKey?: Record<string, () => void>;
  onCopyAsset?: (name: string, groupId: string) => void;
  onUpdateCollection: (id: string, updates: { name?: string; imageSrc?: string }) => void;
  className?: string;
}

export function OnboardingAssetCustomCollectionCard({
  collection,
  selectedAssetsSet,
  extraAssets = [],
  assetFilter = "",
  onAddAsset,
  onRemoveAsset,
  onRenameAsset,
  onViewAsset,
  viewAssetByNameKey = {},
  onCopyAsset,
  onUpdateCollection,
  className,
}: OnboardingAssetCustomCollectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [transitionMs, setTransitionMs] = useState(EXPAND_DURATION_MS);
  const [assetName, setAssetName] = useState("");
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

  const bannerSrc = collection.imageSrc ?? getAssetGroupCardIllustration("custom");

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

  const visibleAssetNames = useMemo(() => {
    const filter = assetFilter.trim().toLowerCase();
    const matchesFilter = (name: string) =>
      !filter || name.toLowerCase().includes(filter);

    const names: string[] = [];
    const seen = new Set<string>();
    const insertAfterQueue: { name: string; afterKey: string }[] = [];

    for (const extra of extraAssets) {
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
      if (typeof extra === "object" && extra.insertAfter) {
        insertAfterQueue.push({
          name: extraName,
          afterKey: extra.insertAfter.toLowerCase().trim(),
        });
        continue;
      }
      names.push(extraName);
    }

    for (const { name, afterKey } of insertAfterQueue) {
      const afterIdx = names.findIndex((n) => n.toLowerCase().trim() === afterKey);
      if (afterIdx >= 0) names.splice(afterIdx + 1, 0, name);
      else names.unshift(name);
    }

    return names.filter(matchesFilter);
  }, [extraAssets, assetFilter]);

  const handleAddAsset = () => {
    const trimmed = assetName.trim();
    if (!trimmed) return;
    if (selectedAssetsSet.has(trimmed.toLowerCase().trim())) {
      toast.error("Asset already added");
      return;
    }
    onAddAsset(trimmed, true);
    setAssetName("");
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
        <div className="relative flex h-full flex-col overflow-hidden rounded-card bg-card shadow-e1">
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
                "rounded-md bg-white/90 text-muted-foreground shadow-sm",
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
              {CUSTOM_ASSET_COLLECTION_DESCRIPTION}
            </p>

            <div
              className={cn(
                "flex flex-wrap content-start items-start gap-x-1.5 gap-y-1 transition-[opacity,transform,margin] ease-out",
                isExpanded
                  ? "mt-[6px] min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y opacity-100 translate-y-0 [scrollbar-width:thin] [scrollbar-color:hsl(185_40%_68%_/_0.45)_transparent]"
                  : "pointer-events-none max-h-0 overflow-hidden opacity-0 translate-y-3"
              )}
              style={transitionStyle}
            >
              {visibleAssetNames.length === 0 ? (
                <p className="py-1 text-2xs font-mono uppercase tracking-wider text-muted-foreground/50">
                  No assets yet
                </p>
              ) : (
                visibleAssetNames.map((name) => {
                  const key = name.toLowerCase().trim();
                  const viewHandler =
                    viewAssetByNameKey[key] ??
                    (onViewAsset
                      ? () => onViewAsset(name, collection.id)
                      : undefined);
                  return (
                    <ExpandableAssetChip
                      key={name}
                      label={name}
                      color={SELECTED_CHIP_TEAL}
                      onRemove={() => onRemoveAsset?.(name)}
                      onRename={
                        onRenameAsset
                          ? () => onRenameAsset(name, collection.id)
                          : undefined
                      }
                      onView={viewHandler}
                      onDuplicate={
                        onCopyAsset
                          ? () => onCopyAsset(name, collection.id)
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
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAsset();
                  }
                }}
                placeholder="Add asset"
                className={INLINE_INPUT_CLASS}
                style={INLINE_INPUT_SHADOW}
              />
              <button
                type="button"
                onClick={handleAddAsset}
                disabled={!assetName.trim()}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-all",
                  "disabled:opacity-50"
                )}
                style={{ backgroundColor: "hsl(var(--primary-deep))" }}
                aria-label="Add asset"
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
            <DialogTitle className="text-base font-mono uppercase tracking-wider">
              Edit collection
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
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
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Card image
              </label>
              <div className="relative h-[80px] overflow-hidden rounded-lg bg-muted">
                <img
                  src={editImagePreview ?? getAssetGroupCardIllustration("custom")}
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
                className="mt-2 text-xs font-mono uppercase tracking-wider text-primary hover:underline disabled:opacity-50"
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
            >
              Save
            </NeomorphicButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
