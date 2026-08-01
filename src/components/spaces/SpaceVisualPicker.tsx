/**
 * Space visual identity control: gallery thumbnail, Lucide “create icon”, or upload.
 * Preview sits without a chrome box; Select thumbnail sits beside it.
 */

import { useRef, useState } from "react";
import { Palette, Upload } from "lucide-react";
import { AIIconColorPicker } from "@/components/ui/AIIconColorPicker";
import { SpaceThumbnailPickerDialog } from "@/components/spaces/SpaceThumbnailPickerDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getAssetIcon } from "@/lib/icon-resolver";
import { cn } from "@/lib/utils";

export type SpaceVisualMode = "thumbnail" | "icon";

export type SpaceVisualValue = {
  mode: SpaceVisualMode;
  thumbnailUrl: string | null;
  iconName: string;
  iconColor: string;
};

type SpaceVisualPickerProps = {
  value: SpaceVisualValue;
  onChange: (next: SpaceVisualValue) => void;
  /** Drives AI icon suggestions in Create Icon. */
  searchText?: string;
  suggestedIcon?: string | null;
  disabled?: boolean;
  className?: string;
  /**
   * Upload handler. Return a URL for the preview.
   * Create flows can read the file, show an object URL, and upload on save.
   */
  onUploadFile: (file: File) => Promise<string>;
};

export function SpaceVisualPicker({
  value,
  onChange,
  searchText = "",
  suggestedIcon,
  disabled = false,
  className,
  onUploadFile,
}: SpaceVisualPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [createIconOpen, setCreateIconOpen] = useState(false);
  const [draftIcon, setDraftIcon] = useState({
    iconName: value.iconName || "box",
    color: value.iconColor || "#8EC9CE",
  });
  const [uploading, setUploading] = useState(false);

  const IconComponent = getAssetIcon(value.iconName || suggestedIcon || "box");
  const showThumbnail = value.mode === "thumbnail" && !!value.thumbnailUrl;

  const openGallery = () => {
    if (disabled) return;
    setGalleryOpen(true);
  };

  const openCreateIcon = () => {
    setDraftIcon({
      iconName: value.iconName || suggestedIcon || "box",
      color: value.iconColor || "#8EC9CE",
    });
    setCreateIconOpen(true);
  };

  const commitCreateIcon = () => {
    onChange({
      mode: "icon",
      thumbnailUrl: null,
      iconName: draftIcon.iconName,
      iconColor: draftIcon.color,
    });
    setCreateIconOpen(false);
  };

  const handleUploadClick = () => {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const url = await onUploadFile(file);
      onChange({
        mode: "thumbnail",
        thumbnailUrl: url,
        iconName: value.iconName || suggestedIcon || "box",
        iconColor: value.iconColor,
      });
    } finally {
      setUploading(false);
    }
  };

  const actionBtnClass = cn(
    "inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-2 py-1.5",
    "text-[11px] font-medium leading-tight whitespace-nowrap",
    "bg-card/80 text-foreground shadow-e1 transition-shadow hover:shadow-md",
    "disabled:pointer-events-none disabled:opacity-50"
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          disabled={disabled}
          onClick={openGallery}
          className={cn(
            "group flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-xl",
            "transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
          aria-label="Select thumbnail"
        >
          {showThumbnail ? (
            <img
              src={value.thumbnailUrl!}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <span
              className="flex h-[88px] w-[88px] items-center justify-center rounded-2xl"
              style={{ backgroundColor: value.iconColor || "#8EC9CE" }}
            >
              <IconComponent className="h-12 w-12 text-white" />
            </span>
          )}
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={openGallery}
          className={cn(
            "shrink-0 text-left text-xs font-medium leading-snug text-foreground/80",
            "transition-colors hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          <span className="block">Select</span>
          <span className="block">thumbnail</span>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={openCreateIcon}
          className={actionBtnClass}
        >
          <Palette className="h-3 w-3 shrink-0" aria-hidden />
          Create icon
        </button>
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={handleUploadClick}
          className={actionBtnClass}
        >
          <Upload className="h-3 w-3 shrink-0" aria-hidden />
          {uploading ? "Uploading…" : "Upload image"}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />

      <SpaceThumbnailPickerDialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        currentSrc={value.mode === "thumbnail" ? value.thumbnailUrl : null}
        spaceName={searchText || undefined}
        title="Select thumbnail"
        onSelect={(src) => {
          onChange({
            mode: "thumbnail",
            thumbnailUrl: src,
            iconName: value.iconName || suggestedIcon || "box",
            iconColor: value.iconColor,
          });
        }}
      />

      <Dialog open={createIconOpen} onOpenChange={setCreateIconOpen}>
        <DialogContent className="max-w-sm gap-3 p-4" aria-describedby="create-icon-desc">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold tracking-tight">
              Create icon
            </DialogTitle>
            <DialogDescription id="create-icon-desc">
              Pick a Lucide icon and colour for this space.
            </DialogDescription>
          </DialogHeader>
          <AIIconColorPicker
            searchText={searchText}
            value={draftIcon}
            onChange={(icon, color) => setDraftIcon({ iconName: icon, color })}
            suggestedIcon={suggestedIcon}
            defaultIcons={["door-open", "bed", "bath", "cooking-pot", "sofa"]}
            fallbackSearch="room"
            showSearchInput
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => setCreateIconOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={commitCreateIcon}>
              Use icon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
