import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildPropertyVisualOccupancy,
  PROPERTY_CORE_ICON_POOL,
  PROPERTY_DEFAULT_ICON_POOL,
} from "@/lib/propertyVisualUniqueness";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { modalScrollFooterClass, modalScrollHeaderClass, modalScrollShellClass } from "@/lib/layoutClasses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocompleteInput } from "@/components/ui/AddressAutocompleteInput";
import { AIIconColorPicker } from "@/components/ui/AIIconColorPicker";
import { getAssetIcon } from "@/lib/icon-resolver";
import { uploadPropertyImageWithThumbnail } from "@/services/properties/propertyImageUpload";
import { enrichPropertyGeo } from "@/services/signals/signalEngineClient";
import type { PlaceSelection } from "@/lib/signals/signalTypes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PropertyForStrip } from "@/components/properties/PropertyIdentityStrip";

type PropertyEditSheetProps = {
  property: PropertyForStrip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive?: () => void;
};

export function PropertyEditSheet({ property, open, onOpenChange, onArchive }: PropertyEditSheetProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { data: orgProperties = [] } = usePropertiesQuery();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(property.nickname ?? "");
  const [address, setAddress] = useState(property.address ?? "");
  const [iconName, setIconName] = useState(property.icon_name ?? "home");
  const [iconColor, setIconColor] = useState(property.icon_color_hex ?? "#8EC9CE");
  const [selectedPlace, setSelectedPlace] = useState<PlaceSelection | null>(null);
  const [propertyImage, setPropertyImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(property.thumbnail_url ?? null);
  const [saving, setSaving] = useState(false);

  const others = useMemo(
    () => orgProperties.filter((p: { id: string }) => p.id !== property.id),
    [orgProperties, property.id]
  );

  const { takenIconsArr, takenColorsArr } = useMemo(() => {
    const o = buildPropertyVisualOccupancy(
      others.map((p: { icon_name?: string | null; icon_color_hex?: string | null }) => ({
        icon_name: p.icon_name,
        icon_color_hex: p.icon_color_hex,
      }))
    );
    return { takenIconsArr: [...o.takenIcons], takenColorsArr: [...o.takenColors] };
  }, [others]);

  useEffect(() => {
    if (!open) return;
    setNickname(property.nickname ?? "");
    setAddress(property.address ?? "");
    setIconName(property.icon_name ?? "home");
    setIconColor(property.icon_color_hex ?? "#8EC9CE");
    setImagePreview(property.thumbnail_url ?? null);
    setPropertyImage(null);
    setSelectedPlace(null);
  }, [open, property]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPropertyImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!address.trim() && !nickname.trim()) {
      toast.error("Add a name or address");
      return;
    }
    setSaving(true);
    try {
      let thumbnailUrl = property.thumbnail_url ?? null;
      if (propertyImage && orgId) {
        const { displayUrl } = await uploadPropertyImageWithThumbnail(supabase, {
          orgId,
          propertyId: property.id,
          file: propertyImage,
        });
        thumbnailUrl = displayUrl;
      }

      const { error } = await supabase
        .from("properties")
        .update({
          nickname: nickname.trim() || null,
          address: address.trim(),
          icon_name: iconName,
          icon_color_hex: iconColor,
          thumbnail_url: thumbnailUrl,
        })
        .eq("id", property.id);

      if (error) throw error;

      if (orgId) {
        void enrichPropertyGeo(
          property.id,
          orgId,
          selectedPlace ?? { formattedAddress: address.trim() }
        );
      }

      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success("Property updated");
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't save property";
      toast.error(message);
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const PreviewIcon = getAssetIcon(iconName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md", modalScrollShellClass)}>
        <DialogHeader className={modalScrollHeaderClass}>
          <DialogTitle>Edit property</DialogTitle>
          <DialogDescription>Update the photo, name, icon, and address.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 py-2">
          <div>
            <Label className="text-xs">Photo</Label>
            <div className="mt-1.5 flex items-center gap-3">
              <div
                className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg"
                style={{
                  backgroundColor: imagePreview ? undefined : iconColor,
                }}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <PreviewIcon className="h-6 w-6 text-white" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-3.5 w-3.5" />
                  {imagePreview ? "Change photo" : "Add photo"}
                </Button>
                {imagePreview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-[11px] text-muted-foreground"
                    onClick={() => {
                      setPropertyImage(null);
                      setImagePreview(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                    Remove photo
                  </Button>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="property-edit-name" className="text-xs">
              Name
            </Label>
            <Input
              id="property-edit-name"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Ampersand"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="property-edit-address" className="text-xs">
              Address
            </Label>
            <AddressAutocompleteInput
              id="property-edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onPlaceSelected={setSelectedPlace}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Icon & colour</Label>
            <AIIconColorPicker
              searchText={nickname.trim() || address.trim()}
              value={{ iconName, color: iconColor }}
              onChange={(icon, color) => {
                setIconName(icon);
                setIconColor(color);
              }}
              defaultIcons={PROPERTY_CORE_ICON_POOL.slice(0, 5)}
              iconRotationPool={PROPERTY_DEFAULT_ICON_POOL}
              fallbackSearch="building"
              suggestedIcon={property.icon_name ?? "home"}
              disabled={saving}
              takenPropertyIconNames={takenIconsArr}
              takenPropertyColorHexes={takenColorsArr}
            />
          </div>
        </DialogBody>

        <DialogFooter className={cn(modalScrollFooterClass, "flex-col gap-2 sm:flex-col sm:space-x-0")}>
          <div className="flex w-full gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving} className="flex-1">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
          {onArchive ? (
            <button
              type="button"
              className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-[#EB6834]"
              onClick={() => {
                onOpenChange(false);
                onArchive();
              }}
            >
              Archive property
            </button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
