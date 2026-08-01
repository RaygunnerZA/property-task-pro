import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cropAvatarVariants } from "@/lib/avatarImage";

type AvatarCropDialogProps = {
  open: boolean;
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: { small: Blob; medium: Blob; previewUrl: string }) => void;
};

export function AvatarCropDialog({
  open,
  imageSrc,
  onOpenChange,
  onConfirm,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setBusy(false);
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setBusy(true);
    try {
      const { small, medium } = await cropAvatarVariants(imageSrc, croppedAreaPixels);
      const previewUrl = URL.createObjectURL(medium);
      onConfirm({ small, medium, previewUrl });
      onOpenChange(false);
    } catch (err) {
      console.error("Avatar crop failed:", err);
      toast.error(err instanceof Error ? err.message : "Could not crop photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-md gap-4 sm:max-w-lg" hideCloseButton={busy}>
        <DialogHeader>
          <DialogTitle>Crop profile photo</DialogTitle>
          <DialogDescription>
            Drag to position, then zoom. We’ll save a small avatar and a medium square crop.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-72 w-full overflow-hidden rounded-[10px] bg-muted shadow-engraved">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="avatar-zoom" className="text-sm">
            Zoom
          </Label>
          <Slider
            id="avatar-zoom"
            min={1}
            max={3}
            step={0.01}
            value={[zoom]}
            onValueChange={([value]) => setZoom(value ?? 1)}
            disabled={busy || !imageSrc}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="shadow-e1"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleConfirm().catch(() => {
                /* parent surfaces toast if needed */
              });
            }}
            disabled={busy || !imageSrc || !croppedAreaPixels}
            className="shadow-e1"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Use photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
