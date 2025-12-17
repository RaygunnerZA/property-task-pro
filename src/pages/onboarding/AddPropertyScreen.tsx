import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    setLoading(true);
    try {
      // Refresh session to ensure JWT has latest org_id claim
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session?.user) {
        toast.error("Please sign in to continue");
        navigate("/login");
        return;
      }

      // Get org_id from refreshed JWT claims (app_metadata)
      const jwtOrgId = refreshData.session.user.app_metadata?.org_id;

      if (!jwtOrgId) {
        toast.error("Organisation not found. Please create one first.");
        navigate("/onboarding/create-organisation");
        return;
      }

      let thumbnailUrl: string | null = null;

      // Upload image if selected
      if (propertyImage) {
        const fileExt = propertyImage.name.split('.').pop();
        const fileName = `${jwtOrgId}/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('task-images')
          .upload(`properties/${fileName}`, propertyImage);

        if (uploadError) {
          console.error("Image upload error:", uploadError);
          toast.error("Failed to upload image, but continuing...");
        } else {
          const { data: urlData } = supabase.storage
            .from('task-images')
            .getPublicUrl(`properties/${fileName}`);
          thumbnailUrl = urlData.publicUrl;
        }
      }

      const { error } = await supabase
        .from('properties')
        .insert({
          org_id: jwtOrgId,
          address: propertyAddress || "No address provided",
          nickname: propertyNickname || null,
          units: propertyUnits,
          icon_name: propertyIcon,
          icon_color_hex: propertyIconColor,
          thumbnail_url: thumbnailUrl
        });

      if (error) throw error;

      toast.success("Property added!");
      navigate("/onboarding/add-spaces");
    } catch (error: any) {
      toast.error(error.message || "Failed to add property");
    } finally {
      setLoading(false);
    }
  };

  const SelectedIcon = PROPERTY_ICONS.find(i => i.name === propertyIcon)?.icon || Building2;

  return (
    <OnboardingContainer>
      <div className="animate-fade-in">
        <ProgressDots current={3} total={6} />
        
        <OnboardingHeader
          title="Add your first property"
          subtitle="You can always add more later"
        />

        {/* Icon Preview */}
        <div className="mb-6 flex justify-center">
          <div 
            className="p-4 rounded-2xl transition-all duration-300"
            style={{
              backgroundColor: propertyIconColor,
              boxShadow: "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)"
            }}
          >
            <SelectedIcon className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Icon Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[#6D7480] mb-2">
            Choose an icon
          </label>
          <div className="flex justify-center gap-3">
            {PROPERTY_ICONS.map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => setPropertyIcon(name)}
                className={`p-3 rounded-xl transition-all duration-200 ${
                  propertyIcon === name 
                    ? "bg-white shadow-lg scale-110" 
                    : "bg-[#E8E4DE] hover:bg-white"
                }`}
                style={{
                  boxShadow: propertyIcon === name 
                    ? "2px 2px 6px rgba(0,0,0,0.15), -1px -1px 4px rgba(255,255,255,0.5)"
                    : "inset 1px 1px 2px rgba(0,0,0,0.05)"
                }}
              >
                <Icon 
                  className="w-5 h-5" 
                  style={{ color: propertyIcon === name ? propertyIconColor : "#6D7480" }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Color Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#6D7480] mb-2">
            Choose a color
          </label>
          <div className="flex justify-center gap-3">
            {PROPERTY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setPropertyIconColor(color)}
                className={`w-8 h-8 rounded-full transition-all duration-200 ${
                  propertyIconColor === color ? "scale-125 ring-2 ring-offset-2 ring-gray-400" : ""
                }`}
                style={{
                  backgroundColor: color,
                  boxShadow: "2px 2px 4px rgba(0,0,0,0.1), -1px -1px 3px rgba(255,255,255,0.3)"
                }}
              />
            ))}
          </div>
        </div>

        {/* Image Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-[#6D7480] mb-2">
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
            <div className="relative rounded-xl overflow-hidden">
              <img 
                src={imagePreview} 
                alt="Property preview" 
                className="w-full h-32 object-cover"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow-md hover:bg-white transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 rounded-xl border-2 border-dashed border-[#D1CCC4] hover:border-[#FF6B6B] transition-colors flex flex-col items-center gap-2"
              style={{
                background: "rgba(255,255,255,0.5)"
              }}
            >
              <Upload className="w-6 h-6 text-[#6D7480]" />
              <span className="text-sm text-[#6D7480]">Tap to upload photo</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
          <NeomorphicInput
            label="Property name"
            placeholder="The Grand Hotel"
            value={propertyNickname}
            onChange={(e) => setPropertyNickname(e.target.value)}
          />

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

          <div className="pt-4">
            <NeomorphicButton
              variant="primary"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Property"}
            </NeomorphicButton>
          </div>
        </div>
      </div>
    </OnboardingContainer>
  );
}
