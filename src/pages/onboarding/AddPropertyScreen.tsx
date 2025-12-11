import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export default function AddPropertyScreen() {
  const navigate = useNavigate();
  const { 
    orgId, 
    propertyNickname, 
    propertyAddress, 
    propertyUnits,
    propertyIcon,
    propertyIconColor,
    setPropertyNickname, 
    setPropertyAddress, 
    setPropertyUnits 
  } = useOnboardingStore();
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    // Address is now optional, no validation needed
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

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

      const { error } = await supabase
        .from('properties')
        .insert({
          org_id: jwtOrgId,
          address: propertyAddress,
          nickname: propertyNickname || null,
          units: propertyUnits,
          icon_name: propertyIcon,
          icon_color_hex: propertyIconColor
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

  const handleSkip = () => {
    navigate("/onboarding/add-spaces");
  };

  return (
    <OnboardingContainer>
      <div className="animate-fade-in">
        <ProgressDots current={3} total={6} />
        
        <OnboardingHeader
          title="Add your first property"
          subtitle="You can always add more later"
        />

        <div className="mb-8 flex justify-center">
          <div 
            className="p-4 rounded-2xl"
            style={{
              backgroundColor: propertyIconColor,
              boxShadow: "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)"
            }}
          >
            <Building2 className="w-10 h-10 text-white" />
          </div>
        </div>

        <div className="space-y-4">
          <NeomorphicInput
            label="Nickname (Optional)"
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

          <div className="pt-4 space-y-3">
            <NeomorphicButton
              variant="primary"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Property"}
            </NeomorphicButton>

            <NeomorphicButton
              variant="ghost"
              onClick={handleSkip}
            >
              Skip for now
            </NeomorphicButton>
          </div>
        </div>
      </div>
    </OnboardingContainer>
  );
}
