/**
 * Space visual identity control: gallery thumbnail, Lucide “create icon”, or upload.
 * Grounded in existing SpaceThumbnailPickerDialog + AIIconColorPicker patterns;
 * three explicit actions instead of inlining the Lucide builder on the main form.
 */

import { useRef, useState } from "react";
import { ImagePlus, Palette, Upload } from "lucide-react";
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

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex justify-center">
        <div
          className={cn(
            "flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-2xl transition-all duration-300",
            showThumbnail ? "bg-muted/40 p-2" : "p-4"
          )}
          style={
            showThumbnail
              ? {
                  boxShadow:
                    "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)",
                }
              : {
                  backgroundColor: value.iconColor || "#8EC9CE",
                  boxShadow:
                    "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)",
                }
          }
        >
          {showThumbnail ? (
            <img
              src={value.thumbnailUrl!}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <IconComponent className="h-10 w-10 text-white" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setGalleryOpen(true)}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium",
            "bg-card/80 text-foreground shadow-e1 transition-shadow hover:shadow-md",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Select icon
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={openCreateIcon}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium",
            "bg-card/80 text-foreground shadow-e1 transition-shadow hover:shadow-md",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          <Palette className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Create icon
        </button>
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={handleUploadClick}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium",
            "bg-card/80 text-foreground shadow-e1 transition-shadow hover:shadow-md",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
        title="Select icon"
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
