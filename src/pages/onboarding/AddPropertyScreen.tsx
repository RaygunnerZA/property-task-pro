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
    const newErrors: Record<string, string> = {};
    
    if (!propertyAddress.trim()) {
      newErrors.address = "Address is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Get current user and their organisation
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        toast.error("Please sign in to continue");
        navigate("/login");
        return;
      }

      // Get user's org_id from organisation_members
      const { data: memberData } = await supabase
        .from('organisation_members')
        .select('org_id')
        .eq('user_id', session.user.id)
        .single();

      if (!memberData?.org_id) {
        toast.error("Organisation not found. Please create one first.");
        navigate("/onboarding/create-organisation");
        return;
      }

      const { error } = await supabase
        .from('properties')
        .insert({
          org_id: memberData.org_id,
          address: propertyAddress,
          nickname: propertyNickname || null,
          units: propertyUnits,
          icon_name: propertyIcon,
          icon_color_hex: propertyIconColor
        });

      if (error) throw error;

      toast.success("Property added!");
      navigate("/onboarding/invite-team");
    } catch (error: any) {
      toast.error(error.message || "Failed to add property");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate("/onboarding/invite-team");
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
            label="Address"
            placeholder="123 Main St, City"
            value={propertyAddress}
            onChange={(e) => setPropertyAddress(e.target.value)}
            error={errors.address}
          />

          <div>
            <label className="block text-sm font-medium text-[#6D7480] mb-2">
              Number of Units
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPropertyUnits(Math.max(1, propertyUnits - 1))}
                className="w-12 h-12 rounded-xl text-[#6D7480] hover:text-[#1C1C1C] transition-colors"
                style={{
                  boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.08), inset -2px -2px 4px rgba(255,255,255,0.7)"
                }}
              >
                −
              </button>
              
              <div 
                className="flex-1 text-center py-3 rounded-xl text-lg font-medium text-[#1C1C1C]"
                style={{
                  boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.08), inset -2px -2px 4px rgba(255,255,255,0.7)"
                }}
              >
                {propertyUnits}
              </div>
              
              <button
                type="button"
                onClick={() => setPropertyUnits(propertyUnits + 1)}
                className="w-12 h-12 rounded-xl text-[#6D7480] hover:text-[#1C1C1C] transition-colors"
                style={{
                  boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.08), inset -2px -2px 4px rgba(255,255,255,0.7)"
                }}
              >
                +
              </button>
            </div>
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
