/**
 * CreateAssetDialog - Standalone (system-scoped) add asset flow (Assets page, property context).
 * Creates a permanent asset in DB. Create Task uses AssetsSection for asset creation (same permanent entity; entry context is task-scoped).
 * Uses ai_icon_search to infer icon from name + type.
 */
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AIIconColorPicker } from "@/components/ui/AIIconColorPicker";
import { invalidateAssetQueries } from "@/lib/invalidateAssetQueries";
import { createTempImage, cleanupTempImage } from "@/utils/image-optimization";
import { toast } from "sonner";

interface CreateAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  spaceId?: string;
  defaultName?: string;
  onAssetCreated?: (assetId: string) => void;
}

type PendingFile = {
  id: string;
  file_url: string;
  thumbnail_url?: string;
  file_type: string;
  displayName: string;
  isImage: boolean;
};

const ASSET_TYPES = [
  "Boiler",
  "Appliance",
  "Vehicle",
  "HVAC",
  "Plumbing",
  "Electrical",
  "Other",
];

function isImageFile(file: File) {
  const t = file.type?.toLowerCase() || "";
  return (
    t.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp"].includes(
      file.name.split(".").pop()?.toLowerCase() || ""
    )
  );
}

export function CreateAssetDialog({
  open,
  onOpenChange,
  propertyId,
  spaceId,
  defaultName,
  onAssetCreated,
}: CreateAssetDialogProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(defaultName || "");
  useEffect(() => {
    if (open && defaultName) setName(defaultName);
  }, [open, defaultName]);
  const [type, setType] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [iconName, setIconName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const resetForm = () => {
    setName("");
    setType("");
    setSerialNumber("");
    setIconName("");
    setPendingFiles([]);
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    asImage: boolean
  ) => {
    const files = e.target.files;
    if (!files?.length || !orgId) {
      if (!orgId) toast.error("Organisation not found");
      return;
    }
    setIsUploadingFile(true);
    try {
      for (const file of Array.from(files)) {
        const isImg = asImage || isImageFile(file);
        if (isImg) {
          const tempImage = await createTempImage(file);
          const uuid = crypto.randomUUID();
          const basePath = `org/${orgId}/assets/pending/${uuid}`;
          const thumbPath = `${basePath}/thumb.webp`;
          const optPath = `${basePath}/optimized.webp`;
          const { error: thumbError } = await supabase.storage
            .from("task-images")
            .upload(thumbPath, tempImage.thumbnail_blob, {
              contentType: "image/webp",
              cacheControl: "31536000",
            });
          if (thumbError) throw thumbError;
          const { error: optError } = await supabase.storage
            .from("task-images")
            .upload(optPath, tempImage.optimized_blob, {
              contentType: "image/webp",
              cacheControl: "31536000",
            });
          if (optError) throw optError;
          const { data: thumbUrl } = supabase.storage
            .from("task-images")
            .getPublicUrl(thumbPath);
          const { data: optUrl } = supabase.storage
            .from("task-images")
            .getPublicUrl(optPath);
          cleanupTempImage(tempImage);
          setPendingFiles((prev) => [
            ...prev,
            {
              id: uuid,
              file_url: optUrl.publicUrl,
              thumbnail_url: thumbUrl.publicUrl,
              file_type: "photo",
              displayName: file.name,
              isImage: true,
            },
          ]);
        } else {
          const ext = file.name.split(".").pop() || "bin";
          const path = `org/${orgId}/assets/pending/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("task-images")
            .upload(path, file, { cacheControl: "3600", upsert: false });
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage
            .from("task-images")
            .getPublicUrl(path);
          setPendingFiles((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              file_url: urlData.publicUrl,
              file_type: file.type || ext,
              displayName: file.name,
              isImage: false,
            },
          ]);
        }
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : err instanceof Error
            ? err.message
            : "Upload failed";
      console.error("[CreateAssetDialog] photo upload failed:", err);
      toast.error(message);
    } finally {
      setIsUploadingFile(false);
      e.target.value = "";
    }
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Asset name is required");
      return;
    }

    if (!orgId) {
      toast.error("Organisation not found");
      return;
    }

    if (!propertyId) {
      toast.error("Property not found");
      return;
    }

    setLoading(true);
    try {
      const { data: inserted, error: insertError } = await supabase
        .from("assets")
        .insert({
          org_id: orgId,
          property_id: propertyId,
          space_id: spaceId || null,
          name: name.trim(),
          asset_type: type || null,
          serial_number: serialNumber.trim() || null,
          condition_score: 100,
          status: "active",
          icon_name: iconName || "box",
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Asset creation error:", insertError);
        throw insertError;
      }

      if (inserted?.id && pendingFiles.length > 0) {
        const linkErrors: string[] = [];
        for (const f of pendingFiles) {
          const { error: fileErr } = await supabase.from("asset_files").insert({
            asset_id: inserted.id,
            file_url: f.file_url,
            thumbnail_url: f.thumbnail_url || null,
            file_type: f.file_type,
          });
          if (fileErr) {
            console.error("Failed to link asset file:", fileErr);
            linkErrors.push(fileErr.message);
          }
        }
        if (linkErrors.length > 0) {
          throw new Error(
            `Asset created but photo link failed: ${linkErrors[0]}`
          );
        }
      }

      await invalidateAssetQueries(queryClient);

      toast.success("Asset created!");

      resetForm();
      onOpenChange(false);

      if (inserted?.id) onAssetCreated?.(inserted.id);
    } catch (err: unknown) {
      console.error("Create asset failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create asset");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if ((loading || isUploadingFile) && !nextOpen) return;
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const searchText = [name, type].filter(Boolean).join(" ").trim();
  const busy = loading || isUploadingFile;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFileSelect(e, true)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          multiple
          onChange={(e) => handleFileSelect(e, true)}
        />

        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>Add New Asset</DialogTitle>
              <DialogDescription>
                Add an asset to this property. The asset will be automatically linked to this
                property.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={busy}
                title="Take photo"
                aria-label="Take photo"
                className="h-[35px] w-[35px] rounded-card flex items-center justify-center bg-muted/60 shadow-e1 hover:shadow-e2 transition-all disabled:pointer-events-none disabled:opacity-50"
              >
                <Camera className="h-5 w-5 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                title="Upload photo"
                aria-label="Upload photo"
                className="h-[35px] w-[35px] rounded-card flex items-center justify-center bg-muted/60 shadow-e1 hover:shadow-e2 transition-all disabled:pointer-events-none disabled:opacity-50"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>
          {pendingFiles.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {pendingFiles.map((f) => (
                <div
                  key={f.id}
                  className="relative group rounded-lg overflow-hidden bg-muted/50 border border-border/50"
                >
                  {f.isImage ? (
                    <img
                      src={f.thumbnail_url || f.file_url}
                      alt={f.displayName}
                      className="w-14 h-14 object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 flex items-center justify-center p-1">
                      <span className="text-2xs text-muted-foreground truncate text-center">
                        {f.displayName}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removePendingFile(f.id)}
                    disabled={busy}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    aria-label="Remove"
                  >
                    <X className="h-5 w-5 text-white" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {isUploadingFile ? (
            <p className="text-xs text-muted-foreground mt-2">Uploading photo…</p>
          ) : null}
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Fridge, Boiler, HVAC Unit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={setType} disabled={busy}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select asset type" />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((assetType) => (
                  <SelectItem key={assetType} value={assetType}>
                    {assetType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="serial">Serial Number (optional)</Label>
            <Input
              id="serial"
              placeholder="e.g. SN123456"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              disabled={busy}
            />
          </div>

          {/* AI Icon + Color (5 each, empty until user types) — assets use icon only; color for future */}
          <AIIconColorPicker
            searchText={searchText}
            value={{ iconName, color: "#8EC9CE" }}
            onChange={(icon) => setIconName(icon)}
            defaultIcons={["package", "box", "wrench", "plug", "cpu"]}
            fallbackSearch="asset"
            disabled={busy}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy || !name.trim()}>
            {loading ? "Creating…" : "Create Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
