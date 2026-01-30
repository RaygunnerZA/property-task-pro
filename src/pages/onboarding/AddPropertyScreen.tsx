import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader, OnboardingLogoutButton } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { OnboardingBreadcrumbs } from "@/components/onboarding/OnboardingBreadcrumbs";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { IconColorPicker } from "@/components/design-system/IconColorPicker";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useOrganization } from "@/hooks/use-organization";
import { getCurrentStep } from "@/utils/onboardingSteps";
import { toast } from "sonner";
import { 
  Building2, 
  Home, 
  Hotel, 
  Warehouse, 
  Store, 
  Castle,
  Upload,
  X
} from "lucide-react";

const PROPERTY_ICONS = [
  { name: "home", icon: Home, label: "Home" },
  { name: "building", icon: Building2, label: "Building" },
  { name: "hotel", icon: Hotel, label: "Hotel" },
  { name: "warehouse", icon: Warehouse, label: "Warehouse" },
  { name: "store", icon: Store, label: "Store" },
  { name: "castle", icon: Castle, label: "Castle" },
];

const PROPERTY_COLORS = [
  "#FF6B6B", // Coral
  "#4ECDC4", // Teal
  "#45B7D1", // Sky Blue
  "#96CEB4", // Sage
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
];

export default function AddPropertyScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { orgId, isLoading: orgLoading, error: orgError } = useActiveOrg();
  const { organization } = useOrganization();
  const { 
    propertyNickname, 
    propertyAddress, 
    propertyUnits,
    propertyIcon,
    propertyIconColor,
    setPropertyNickname, 
    setPropertyAddress,
    setPropertyIcon,
    setPropertyIconColor
  } = useOnboardingStore();
  
  const [loading, setLoading] = useState(false);
  const [propertyImage, setPropertyImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hasExistingProperties, setHasExistingProperties] = useState(false);

  useEffect(() => {
    if (orgId && !orgLoading) {
      checkExistingProperties();
    } else if (!orgLoading && !orgId) {
      // No org found - redirect to create organisation
      toast.error("Please create an organisation first");
      navigate("/onboarding/create-organisation", { replace: true });
    }
  }, [orgId, orgLoading]);

  const checkExistingProperties = async () => {
    if (!orgId) return;
    
    try {
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id')
        .eq('org_id', orgId);
      
      if (propertiesError) {
        console.error("Error checking existing properties:", propertiesError);
        setHasExistingProperties(false);
        return;
      }
      
      const hasProperties = properties && properties.length > 0;
      console.log(`[AddPropertyScreen] Found ${properties?.length || 0} properties for org ${orgId}`);
      setHasExistingProperties(hasProperties);
    } catch (error) {
      console.error("Error checking existing properties:", error);
      setHasExistingProperties(false);
    }
  };

  // Show loading state while org is being fetched
  if (orgLoading) {
    return (
      <OnboardingContainer>
        <div className="animate-fade-in">
          <ProgressDots current={getCurrentStep(location.pathname)} />
          <OnboardingHeader
            title="Loading..."
            subtitle="Setting up your workspace"
          />
        </div>
      </OnboardingContainer>
    );
  }

  // Redirect if org not found
  if (orgError || !orgId) {
    return (
      <OnboardingContainer>
        <div className="animate-fade-in">
          <ProgressDots current={getCurrentStep(location.pathname)} />
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

      // Use RPC function to create property (bypasses RLS with SECURITY DEFINER).
      // Pass all 6 params so PostgreSQL picks the single overload (avoids ambiguity with 2-param version).
      const { data: newProperty, error } = await supabase.rpc('create_property_v2', {
        p_org_id: orgId,
        p_address: finalAddress,
        p_nickname: propertyNickname?.trim() || null,
        p_icon_name: null,
        p_icon_color_hex: null,
        p_thumbnail_url: null,
      });

      if (error) {
        console.error("Property insert error:", error);
        console.error("OrgId:", orgId);
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        console.error("UserId:", currentUser?.id);
        throw error;
      }

      if (!newProperty) {
        throw new Error("Property was not created");
      }

      toast.success("Property added!");
      
      // Mark that we're navigating from onboarding to prevent AppInitializer interference
      (window as any).__lastOnboardingNavigation = Date.now();
      
      // Navigate to next step
      navigate("/onboarding/add-spaces");
    } catch (error: any) {
      console.error("Error adding property:", error);
      toast.error(error.message || "Failed to add property");
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Mark navigation to prevent AppInitializer interference
    (window as any).__lastOnboardingNavigation = Date.now();
    navigate("/onboarding/add-spaces");
  };

  const SelectedIcon = PROPERTY_ICONS.find(i => i.name === propertyIcon)?.icon || Building2;

  const stepIcon = (
    <div
      className="p-4 rounded-2xl transition-all duration-300"
      style={{
        backgroundColor: propertyIconColor,
        boxShadow: "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)"
      }}
    >
      <SelectedIcon className="w-10 h-10 text-white" />
    </div>
  );

  return (
    <OnboardingContainer topRight={<OnboardingLogoutButton />}>
      <div className="animate-fade-in">
        <ProgressDots current={3} total={6} />
        
        {/* Property icon above title, left-aligned */}
        <div className="flex justify-center items-center mt-[33px] mb-[10px]">
          {stepIcon}
        </div>

        <OnboardingHeader
          title={hasExistingProperties ? "Add another property" : "Add your first property"}
          subtitle={hasExistingProperties 
            ? "You already have properties. Add another or skip to continue."
            : "You can always add more later"
          }
          showLogout={false}
        />

        {/* Icon + Colour selector (magnetic horizontal scroll) */}
        <div className="mb-6">
          <IconColorPicker
            value={{ icon: propertyIcon, color: propertyIconColor }}
            onChange={({ icon, color }) => {
              setPropertyIcon(icon);
              setPropertyIconColor(color);
            }}
            icons={PROPERTY_ICONS}
            colors={PROPERTY_COLORS}
          />
        </div>

        {/* Property name + Property photo (optional) on same row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
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

          <NeomorphicInput
            label="Address (Optional)"
            placeholder="123 Main St, City"
            value={propertyAddress}
            onChange={(e) => setPropertyAddress(e.target.value)}
          />

          <div className="text-center pt-4">
            <p className="text-sm text-[#6D7480]">
              If you have multiple properties,{" "}
              <button
                type="button"
                onClick={() => {
                  toast.info("CSV upload coming soon");
                }}
                className="text-[#FF6B6B] font-medium hover:underline"
              >
                click here to upload CSV
              </button>
            </p>
          </div>

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
                Continue (you already have properties)
              </NeomorphicButton>
            )}
          </div>
        </div>
      </div>
    </OnboardingContainer>
  );
}
