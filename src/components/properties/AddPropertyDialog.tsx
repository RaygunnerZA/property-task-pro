/**
 * AddPropertyDialog - Standalone (system-scoped) add property flow.
 * Creates a permanent property in DB. Also used from LeftColumn / Properties page.
 * Create Task uses WhereTab/WherePanel for property creation (same permanent entity; entry context is task-scoped).
 */
import { useState, useRef, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildPropertyVisualOccupancy,
  firstFreeColorFromPalette,
  firstFreeIconFromList,
  normalizePropertyColorHex,
  normalizePropertyIconKey,
} from "@/lib/propertyVisualUniqueness";
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
import { toast } from "sonner";
import { AIIconColorPicker } from "@/components/ui/AIIconColorPicker";
import { getAssetIcon } from "@/lib/icon-resolver";
import { uploadPropertyImageWithThumbnail } from "@/services/properties/propertyImageUpload";
import { Upload, X } from "lucide-react";

interface AddPropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (property: {
    id: string;
    address: string;
    nickname: string | null;
    icon_name: string;
    icon_color_hex: string;
  }) => void;
}

export function AddPropertyDialog({ open, onOpenChange, onCreated }: AddPropertyDialogProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { data: orgProperties = [] } = usePropertiesQuery();

  const { takenIconsArr, takenColorsArr } = useMemo(() => {
    const o = buildPropertyVisualOccupancy(
      orgProperties.map((p: { id: string; icon_name?: string | null; icon_color_hex?: string | null }) => ({
        id: p.id,
        icon_name: p.icon_name,
        icon_color_hex: p.icon_color_hex,
      }))
    );
    return { takenIconsArr: [...o.takenIcons], takenColorsArr: [...o.takenColors] };
  }, [orgProperties]);

  useEffect(() => {
    if (!open) return;
    const { takenIcons, takenColors } = buildPropertyVisualOccupancy(
      orgProperties.map((p: { id: string; icon_name?: string | null; icon_color_hex?: string | null }) => ({
        id: p.id,
        icon_name: p.icon_name,
        icon_color_hex: p.icon_color_hex,
      }))
    );
    setIconColor((prev) => {
      if (!takenColors.has(normalizePropertyColorHex(prev))) return prev;
      return firstFreeColorFromPalette(takenColors) ?? prev;
    });
    setIconName((prev) => {
      const key = normalizePropertyIconKey(prev || "building");
      if (!takenIcons.has(key)) return prev || "building";
      return (
        firstFreeIconFromList(
          [
            "building",
            "home",
            "hotel",
            "warehouse",
            "store",
            "castle",
            "landmark",
            "trees",
            "factory",
            "school",
          ],
          takenIcons
        ) ?? "building"
      );
    });
  }, [open, orgProperties]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  const [nickname, setNickname] = useState("");
  const [iconName, setIconName] = useState("");
  const [iconColor, setIconColor] = useState("#8EC9CE");
  const [propertyImage, setPropertyImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPropertyImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setPropertyImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!address.trim() && !nickname.trim()) {
      toast.error("Property name or address is required");
      return;
    }

    if (!orgId) {
      toast.error("Organisation not found");
      return;
    }

    const { takenIcons, takenColors } = buildPropertyVisualOccupancy(
      orgProperties.map((p: { id: string; icon_name?: string | null; icon_color_hex?: string | null }) => ({
        id: p.id,
        icon_name: p.icon_name,
        icon_color_hex: p.icon_color_hex,
      }))
    );
    if (takenColors.has(normalizePropertyColorHex(iconColor))) {
      toast.error("That colour is already used by another property in this organisation");
      return;
    }
    if (takenIcons.has(normalizePropertyIconKey(iconName || "building"))) {
      toast.error("That icon is already used by another property in this organisation");
      return;
    }

    setLoading(true);
    try {
      // Use nickname as address if address is empty
      const finalAddress = address.trim() || nickname.trim() || "No address provided";

      // Check for duplicate property address within this org
      const { data: existingProperties, error: checkError } = await supabase
        .from("properties")
        .select("id, address")
        .eq("org_id", orgId)
        .ilike("address", finalAddress);

      if (checkError) {
        console.error("Error checking duplicates:", checkError);
      } else if (existingProperties && existingProperties.length > 0) {
        toast.error("A property with this address already exists");
        setLoading(false);
        return;
      }

      // Create property first (without image)
      const { data: newProperty, error: createError } = await supabase.rpc("create_property_v2", {
        p_org_id: orgId,
        p_address: finalAddress,
        p_nickname: nickname.trim() || null,
        p_icon_name: iconName || "building",
        p_icon_color_hex: iconColor,
        p_thumbnail_url: null, // Will be set after thumbnail generation
      });

      if (createError) {
        console.error("Property creation error:", createError);
        throw createError;
      }

      if (!newProperty) {
        throw new Error("Failed to create property: no data returned");
      }

      const propertyId = (newProperty as any).id;
      const created = {
        id: propertyId,
        address: finalAddress,
        nickname: nickname.trim() || null,
        icon_name: iconName || "building",
        icon_color_hex: iconColor,
      };

      if (propertyImage && propertyId) {
        try {
          const { displayUrl } = await uploadPropertyImageWithThumbnail(supabase, {
            orgId,
            propertyId,
            file: propertyImage,
          });
          if (displayUrl) {
            queryClient.setQueryData(["properties", orgId], (prev: unknown) => {
              const list = prev as Array<{ id: string; thumbnail_url?: string | null }> | undefined;
              if (!list) return list;
              return list.map((p) =>
                p.id === propertyId ? { ...p, thumbnail_url: displayUrl } : p
              );
            });
          }
        } catch (uploadErr) {
          console.error("Image upload failed:", uploadErr);
          toast.warning("Property created but image upload failed");
        }
      }

      toast.success("Property created!");
      onCreated?.(created);
      // Reset form
      setAddress("");
      setNickname("");
      setIconName("");
      setIconColor("#8EC9CE");
      setPropertyImage(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    } catch (err: any) {
      console.error("Create property failed:", err);
      toast.error(err.message || "Failed to create property");
    } finally {
      setLoading(false);
    }
  };

  const IconComponent = getAssetIcon(iconName || "building");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Property</DialogTitle>
          <DialogDescription>
            Enter the property details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Icon Preview */}
          <div className="flex justify-center">
            <div
              className="p-4 rounded-2xl transition-all duration-300"
              style={{
                backgroundColor: iconColor,
                boxShadow:
                  "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)",
              }}
            >
              <IconComponent className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Property Name - first so AI can suggest icons as user types */}
          <div className="grid gap-2">
            <Label htmlFor="nickname">Property name *</Label>
            <Input
              id="nickname"
              placeholder="The Grand Hotel"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Address */}
          <div className="grid gap-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Input
              id="address"
              placeholder="123 Main St, City, State ZIP"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* AI Icon + Color (5 each, empty until user types) */}
          <AIIconColorPicker
            searchText={nickname.trim() || address.trim()}
            value={{ iconName, color: iconColor }}
            onChange={(icon, color) => {
              setIconName(icon);
              setIconColor(color);
            }}
            defaultIcons={["building", "home", "hotel", "warehouse", "store"]}
            fallbackSearch="building"
            disabled={loading}
            takenPropertyIconNames={takenIconsArr}
            takenPropertyColorHexes={takenColorsArr}
          />

          {/* Image Upload */}
          <div>
            <Label className="mb-2 block">Property photo (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              disabled={loading}
            />
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Property preview"
                  className="w-full h-32 object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={loading}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow-md hover:bg-white transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full py-4 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-colors flex flex-col items-center gap-2 bg-muted/30"
              >
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Tap to upload photo
                </span>
              </button>
            )}
          </div>

        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              // Reset form when closing
              setAddress("");
              setNickname("");
              setIconName("");
              setIconColor("#8EC9CE");
              setPropertyImage(null);
              setImagePreview(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || (!address.trim() && !nickname.trim())}
          >
            {loading ? "Creating..." : "Create Property"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

