import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useEffectiveAccess } from "@/hooks/useEffectiveAccess";
import { useOrgEntitlements } from "@/hooks/useOrgEntitlements";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { markQuickWinComplete } from "@/lib/quickWins";
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog";
import { upgradeCopy } from "@/lib/billing/planCatalog";
import { trackQuotaBlocked, trackUpgradeCtaClicked } from "@/lib/billing/quotaTelemetry";

type PropertyEditSheetProps = {
  property: PropertyForStrip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchive?: () => void;
};

type SheetTab = "edit" | "add";

export function PropertyEditSheet({ property, open, onOpenChange, onArchive }: PropertyEditSheetProps) {
  const navigate = useNavigate();
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const { data: orgProperties = [] } = usePropertiesQuery();
  const { canAddProperty, expansionAllowed, canManageBilling } = useEffectiveAccess();
  const { entitlements } = useOrgEntitlements();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<SheetTab>("edit");
  const [showAddDialog, setShowAddDialog] = useState(false);

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

  const atPropertyLimit =
    orgProperties.length >= entitlements.active_properties_limit;
  /** Client UX gate — create_property_v2 still enforces on the server. */
  const blockedFromAdd = !canAddProperty || atPropertyLimit || !expansionAllowed;

  const upgradeMoment = !expansionAllowed
    ? "payment_recovery"
    : "second_property";
  const upgrade = upgradeCopy(upgradeMoment);

  useEffect(() => {
    if (!open) return;
    setTab("edit");
    setNickname(property.nickname ?? "");
    setAddress(property.address ?? "");
    setIconName(property.icon_name ?? "home");
    setIconColor(property.icon_color_hex ?? "#8EC9CE");
    setImagePreview(property.thumbnail_url ?? null);
    setPropertyImage(null);
    setSelectedPlace(null);
  }, [open, property]);

  const handleTabChange = (next: string) => {
    if (next === "edit") {
      setTab("edit");
      return;
    }
    if (blockedFromAdd) {
      setTab("add");
      if (orgId) trackQuotaBlocked(orgId, "properties");
      return;
    }
    // Entitled: hand off to the dedicated create flow.
    onOpenChange(false);
    setShowAddDialog(true);
  };

  const handleUpgrade = () => {
    if (orgId) trackUpgradeCtaClicked(orgId, upgradeMoment);
    onOpenChange(false);
    navigate("/settings/billing");
  };

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
      const celebrated = markQuickWinComplete("profile", property.id);
      if (!celebrated) toast.success("Property updated");
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("max-w-md", modalScrollShellClass)}>
          <DialogHeader className={modalScrollHeaderClass}>
            <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="flex h-auto w-full items-end justify-between gap-2 rounded-none bg-transparent p-0 pr-8">
                <TabsTrigger
                  value="edit"
                  className={cn(
                    "rounded-none border-b-2 border-transparent px-1 pb-2 pt-0 text-base font-semibold shadow-none",
                    "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
                    "data-[state=inactive]:text-muted-foreground"
                  )}
                >
                  Edit property
                </TabsTrigger>
                <TabsTrigger
                  value="add"
                  className={cn(
                    "ml-auto rounded-none border-b-2 border-transparent px-1 pb-2 pt-0 text-base font-semibold shadow-none",
                    "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
                    "data-[state=inactive]:text-muted-foreground"
                  )}
                >
                  Add new property
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <DialogTitle className="sr-only">
              {tab === "edit" ? "Edit property" : "Add new property"}
            </DialogTitle>
            <DialogDescription>
              {tab === "edit"
                ? "Update the photo, name, icon, and address."
                : upgrade.description}
            </DialogDescription>
          </DialogHeader>

          {tab === "edit" ? (
            <>
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
                          className="h-7 gap-1 text-caption text-muted-foreground"
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
                    className="text-caption font-medium text-muted-foreground transition-colors hover:text-accent"
                    onClick={() => {
                      onOpenChange(false);
                      onArchive();
                    }}
                  >
                    Archive property
                  </button>
                ) : null}
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogBody className="space-y-4 py-4">
                <div className="rounded-xl bg-background/60 px-4 py-5 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.06)]">
                  <h3 className="text-base font-semibold text-foreground">{upgrade.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {upgrade.description}
                  </p>
                  {!expansionAllowed ? null : (
                    <p className="mt-3 text-caption text-muted-foreground">
                      Home and Home Plus include one active property. A second property needs
                      Portfolio.
                    </p>
                  )}
                </div>
              </DialogBody>
              <DialogFooter className={cn(modalScrollFooterClass, "flex-col gap-2 sm:flex-col sm:space-x-0")}>
                <div className="flex w-full gap-2">
                  <Button type="button" variant="outline" onClick={() => setTab("edit")}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleUpgrade}
                    className="flex-1"
                    disabled={!canManageBilling}
                    title={
                      !canManageBilling
                        ? "Ask the primary owner to upgrade billing"
                        : undefined
                    }
                  >
                    {upgrade.cta}
                  </Button>
                </div>
                {!canManageBilling ? (
                  <p className="text-center text-caption text-muted-foreground">
                    Only the primary owner can change the plan.
                  </p>
                ) : null}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AddPropertyDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </>
  );
}
