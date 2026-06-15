import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader, OnboardingLogoutButton } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { OnboardingBreadcrumbs } from "@/components/onboarding/OnboardingBreadcrumbs";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicAddressInput } from "@/components/onboarding/NeomorphicAddressInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { AIIconColorPicker } from "@/components/ui/AIIconColorPicker";
import { getAssetIcon } from "@/lib/icon-resolver";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useCreatePropertyMutation } from "@/hooks/mutations/useCreatePropertyMutation";
import { uploadPropertyImageWithThumbnail } from "@/services/properties/propertyImageUpload";
import { useOrganization } from "@/hooks/use-organization";
import { toast } from "sonner";
import { Pencil, Upload, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { paperTexturedColorStyle } from "@/lib/paperTexture";
import { PropertyCsvImport } from "@/components/properties/PropertyCsvImport";
import type { PlaceSelection } from "@/lib/signals/signalTypes";
import { enrichPropertyGeo } from "@/services/signals/signalEngineClient";
import {
  buildPropertyVisualOccupancy,
  firstFreeColorFromPalette,
  firstFreeIconFromList,
  normalizePropertyColorHex,
  normalizePropertyIconKey,
  PROPERTY_CORE_ICON_POOL,
  PROPERTY_DEFAULT_ICON_POOL,
  type PropertyVisualRow,
} from "@/lib/propertyVisualUniqueness";
import { isPropertyProfileId } from "@/lib/propertyProfiles";

export default function AddPropertyScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const createPropertyMutation = useCreatePropertyMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { orgId: orgIdFromQuery, isLoading: orgLoading, error: orgError } = useActiveOrg();
  const { organization } = useOrganization();
  const {
    propertyNickname,
    propertyAddress,
    propertyUnits,
    propertyIcon,
    propertyIconColor,
    propertyProfile,
    setPropertyNickname,
    setPropertyAddress,
    setPropertyIcon,
    setPropertyIconColor,
    setPropertyProfile,
  } = useOnboardingStore();

  // Use orgId from navigation state when coming from create-org (avoids race before DB/cache propagate)
  const orgIdFromState = (location.state as { orgId?: string })?.orgId;
  const orgId = orgIdFromQuery ?? orgIdFromState ?? null;

  const [loading, setLoading] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSelection | null>(null);
  const [propertyImage, setPropertyImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hasExistingProperties, setHasExistingProperties] = useState(false);
  const [orgPropertyVisualRows, setOrgPropertyVisualRows] = useState<PropertyVisualRow[]>([]);

  const { takenIconsArr, takenColorsArr } = useMemo(() => {
    const o = buildPropertyVisualOccupancy(orgPropertyVisualRows);
    return { takenIconsArr: [...o.takenIcons], takenColorsArr: [...o.takenColors] };
  }, [orgPropertyVisualRows]);

  useEffect(() => {
    if (propertyProfile) return;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      const stored = user?.user_metadata?.property_profile;
      if (isPropertyProfileId(stored)) {
        setPropertyProfile(stored);
      }
    });
  }, [propertyProfile, setPropertyProfile]);

  useEffect(() => {
    if (orgId) {
      checkExistingProperties();
    } else if (!orgLoading && !orgIdFromState) {
      // No org found and not coming from create-org - redirect
      toast.error("Please create an organisation first");
      navigate("/onboarding/create-organisation", { replace: true });
    }
  }, [orgId, orgLoading, orgIdFromState, navigate]);

  const checkExistingProperties = async () => {
    if (!orgId) return;
    
    try {
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, icon_name, icon_color_hex')
        .eq('org_id', orgId);
      
      if (propertiesError) {
        console.error("Error checking existing properties:", propertiesError);
        setHasExistingProperties(false);
        setOrgPropertyVisualRows([]);
        return;
      }
      
      const hasProperties = properties && properties.length > 0;
      setHasExistingProperties(hasProperties);
      setOrgPropertyVisualRows(
        (properties ?? []) as PropertyVisualRow[]
      );
    } catch (error) {
      console.error("Error checking existing properties:", error);
      setHasExistingProperties(false);
      setOrgPropertyVisualRows([]);
    }
  };

  useEffect(() => {
    if (!orgPropertyVisualRows.length) return;
    const { takenIcons, takenColors } = buildPropertyVisualOccupancy(orgPropertyVisualRows);
    const { propertyIconColor: c, propertyIcon: ic, setPropertyIconColor, setPropertyIcon } =
      useOnboardingStore.getState();
    if (takenColors.has(normalizePropertyColorHex(c))) {
      const next = firstFreeColorFromPalette(takenColors);
      if (next) setPropertyIconColor(next);
    }
    if (takenIcons.has(normalizePropertyIconKey(ic || "building"))) {
      const next = firstFreeIconFromList([...PROPERTY_DEFAULT_ICON_POOL], takenIcons);
      if (next) setPropertyIcon(next);
    }
  }, [orgPropertyVisualRows]);

  // Show loading only when we have no orgId (from query or state) and query is still loading
  if (!orgId && orgLoading) {
    return (
      <OnboardingContainer>
        <div className="animate-fade-in">
          <ProgressDots />
          <OnboardingHeader
            title="Loading..."
            subtitle="Setting up your workspace"
          />
        </div>
      </OnboardingContainer>
    );
  }

  // Redirect / org not found only when we have no orgId and we're not coming from create-org
  if ((orgError || !orgId) && !orgIdFromState) {
    return (
      <OnboardingContainer>
        <div className="animate-fade-in">
          <ProgressDots />
          <OnboardingHeader
            title="Organisation not found"
            subtitle="Please create an organisation first"
            showBack
            onBack={() => navigate("/onboarding/create-organisation")}
          />
          <div className="pt-4">
            <NeomorphicButton
              variant="primary"
              onClick={() => navigate("/onboarding/create-organisation")}
            >
              Create Organisation
            </NeomorphicButton>
          </div>
        </div>
      </OnboardingContainer>
    );
  }

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
    if (!propertyNickname.trim()) {
      toast.error("Property name is required");
      return;
    }

    setLoading(true);
    try {
      // Double-check orgId is available (shouldn't happen due to guard above, but safety check)
      if (!orgId) {
        toast.error("Organisation not found. Please create one first.");
        navigate("/onboarding/create-organisation");
        return;
      }

      // Check for duplicate property name/address within this org
      const { data: existingProperties, error: checkError } = await supabase
        .from('properties')
        .select('id, address, org_id')
        .eq('org_id', orgId);

      if (checkError) {
        console.error("Error checking for duplicate properties:", checkError);
      } else if (existingProperties) {
        // Check if any property has the same name or address
        // Note: Currently properties only have 'address' field, so we check that
        const propertyNameOrAddress = propertyNickname.trim() || propertyAddress?.trim();
        
        const duplicate = existingProperties.find(p => {
          const existingNameOrAddress = p.address?.toLowerCase().trim();
          const isMatch = existingNameOrAddress === propertyNameOrAddress?.toLowerCase().trim();
          return isMatch;
        });
        
        if (duplicate) {
          toast.error("A property with this name or address already exists in your organisation");
          setLoading(false);
          return;
        }
      }

      // Use propertyNickname as address if propertyAddress is empty
      const finalAddress = propertyAddress?.trim() || propertyNickname.trim() || "No address provided";

      const { takenIcons, takenColors } = buildPropertyVisualOccupancy(orgPropertyVisualRows);
      if (takenColors.has(normalizePropertyColorHex(propertyIconColor || "#8EC9CE"))) {
        toast.error("That colour is already used by another property in this organisation");
        setLoading(false);
        return;
      }
      if (takenIcons.has(normalizePropertyIconKey(propertyIcon || "building"))) {
        toast.error("That icon is already used by another property in this organisation");
        setLoading(false);
        return;
      }

      const { propertyId } = await createPropertyMutation.mutateAsync({
        p_org_id: orgId,
        p_address: finalAddress,
        p_nickname: propertyNickname?.trim() || null,
        p_icon_name: propertyIcon || "building",
        p_icon_color_hex: propertyIconColor || "#8EC9CE",
        p_thumbnail_url: null,
      });

      if (propertyImage && propertyId && orgId) {
        try {
          await uploadPropertyImageWithThumbnail(supabase, {
            orgId,
            propertyId,
            file: propertyImage,
          });
        } catch (imgErr) {
          console.error("Property photo upload failed:", imgErr);
          toast.warning(
            "Property saved but photo upload failed — you can add a photo later from the property page."
          );
        }
      }

      toast.success("Property added! Sample tasks and examples are being added to your workspace.");

      void enrichPropertyGeo(propertyId, orgId, selectedPlace ?? { formattedAddress: finalAddress });

      // Mark that we're navigating from onboarding to prevent AppInitializer interference
      (window as any).__lastOnboardingNavigation = Date.now();
    } catch (error: unknown) {
      console.error("Error adding property:", error);
      const message = error instanceof Error ? error.message : "Failed to add property";
      toast.error(message);
      return;
    } finally {
      setLoading(false);
    }

    navigate("/onboarding/add-spaces");
  };

  const handleSkip = () => {
    // Mark navigation to prevent AppInitializer interference
    (window as any).__lastOnboardingNavigation = Date.now();
    navigate("/onboarding/add-spaces");
  };

  const IconComponent = getAssetIcon(propertyIcon || "building");

  const stepIconStyle = {
    ...paperTexturedColorStyle(propertyIconColor),
    backgroundColor: "rgba(255, 255, 255, 1)",
    boxShadow:
      "2px 3px 3px 0px rgba(255, 255, 255, 0.75), -1px -1px 1px 1px rgba(0, 0, 0, 0.15), inset 1px 3px 3px 0px rgba(0, 0, 0, 0.15)",
  } as const;

  return (
    <OnboardingContainer topRight={<OnboardingLogoutButton />}>
      <div className="animate-fade-in">
        <ProgressDots current={3} total={6} />
        
        {/* Property icon with edit affordance */}
        <div className="flex flex-col items-center mt-[33px] mb-[10px]">
          <div className="relative group">
            <div
              className={cn(
                "paper-textured-color relative overflow-hidden p-4 rounded-2xl transition-all duration-300",
                "group-hover:scale-[1.03] group-hover:brightness-[1.03]",
                iconPickerOpen && "ring-2 ring-offset-2 ring-foreground/20"
              )}
              style={stepIconStyle}
            >
              <IconComponent className="relative z-10 w-10 h-10 text-white drop-shadow-sm" />
            </div>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Edit icon"
                  aria-expanded={iconPickerOpen}
                  onClick={() => setIconPickerOpen((open) => !open)}
                  className={cn(
                    "absolute -top-1.5 -right-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full",
                    "bg-white/95 text-[#6D7480] shadow-md transition-all duration-200",
                    "opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:text-[#FF6B6B]",
                    "hover:bg-white hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B6B]/40",
                    iconPickerOpen && "opacity-100 scale-110 text-[#FF6B6B] ring-2 ring-[#FF6B6B]/30"
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Edit icon</TooltipContent>
            </Tooltip>
          </div>

          {iconPickerOpen && (
            <div className="mt-4 w-full animate-fade-in">
              <AIIconColorPicker
                searchText={propertyNickname.trim() || propertyAddress?.trim() || ""}
                value={{ iconName: propertyIcon, color: propertyIconColor }}
                onChange={(icon, color) => {
                  setPropertyIcon(icon);
                  setPropertyIconColor(color);
                }}
                defaultIcons={PROPERTY_CORE_ICON_POOL.slice(0, 5)}
                iconRotationPool={PROPERTY_DEFAULT_ICON_POOL}
                fallbackSearch="building"
                disabled={loading}
                takenPropertyIconNames={takenIconsArr}
                takenPropertyColorHexes={takenColorsArr}
                showLabels={false}
              />
            </div>
          )}
        </div>

        <OnboardingHeader
          title="Add a Property"
          subtitle={hasExistingProperties 
            ? "You already have properties. Add another or skip to continue."
            : "You can always add more later"
          }
          showLogout={false}
        />

        {/* Property name + Property photo (optional) on same row — name first so AI suggests icons */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <NeomorphicInput
              label="Property name"
              placeholder="The Grand Hotel"
              value={propertyNickname}
              onChange={(e) => setPropertyNickname(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#6D7480] mb-2 text-center">
              Property photo (optional)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden min-h-[48px] h-[48px]">
                <img 
                  src={imagePreview} 
                  alt="Property preview" 
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-1 right-1 p-1 bg-white/90 rounded-full shadow-md hover:bg-white transition-colors"
                >
                  <X className="w-3 h-3 text-gray-600" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-[48px] rounded-xl border-2 border-dashed border-[#D1CCC4] hover:border-[#FF6B6B] transition-colors flex items-center justify-center gap-2"
                style={{
                  background: "rgba(255,255,255,0.5)"
                }}
              >
                <Upload className="w-5 h-5 text-[#6D7480]" />
                <span className="text-sm text-[#6D7480]">Upload photo</span>
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">

          <NeomorphicAddressInput
            label="Address (Optional)"
            placeholder="Start typing an address…"
            value={propertyAddress}
            onChange={(e) => setPropertyAddress(e.target.value)}
            onPlaceSelected={setSelectedPlace}
          />

          {propertyProfile === "portfolio" && (
            <div className="text-center pt-4">
              <p className="text-sm text-[#6D7480]">
                If you have multiple properties, <PropertyCsvImport />
              </p>
            </div>
          )}

          <div className="pt-4 space-y-3">
            <NeomorphicButton
              variant="primary"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Property"}
            </NeomorphicButton>
            
            {hasExistingProperties && (
              <NeomorphicButton
                variant="ghost"
                onClick={handleSkip}
              >
                Skip for now
              </NeomorphicButton>
            )}
          </div>
        </div>
      </div>
    </OnboardingContainer>
  );
}
