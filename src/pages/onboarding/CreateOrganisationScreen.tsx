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

export default function CreateOrganisationScreen() {
  const navigate = useNavigate();
  const { orgName, orgSlug, userId, setOrgName, setOrgId, propertyType, setPropertyType } = useOnboardingStore();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!orgName.trim()) {
      setError("Organisation name is required");
      return;
    }

    setLoading(true);
    try {
      // Get current user from session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        toast.error("Please sign in to continue");
        navigate("/login");
        return;
      }

      const currentUserId = session.user.id;

      // Create organisation
      const { data: org, error: orgError } = await supabase
        .from('organisations')
        .insert({
          name: orgName,
          slug: orgSlug,
          created_by: currentUserId
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add user as organisation member
      const { error: memberError } = await supabase
        .from('organisation_members')
        .insert({
          org_id: org.id,
          user_id: currentUserId,
          role: 'owner'
        });

      if (memberError) throw memberError;

      setOrgId(org.id);
      toast.success("Organisation created!");
      navigate("/onboarding/add-property");
    } catch (error: any) {
      toast.error(error.message || "Failed to create organisation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingContainer>
      <div className="animate-fade-in">
        <ProgressDots current={2} total={6} />
        
        <OnboardingHeader
          title="Create your organisation"
          subtitle="Give your team a home"
        />

        <div className="space-y-6">
          <NeomorphicInput
            label="Organisation Name"
            placeholder="Acme Property Group"
            value={orgName}
            onChange={(e) => {
              setOrgName(e.target.value);
              setError("");
            }}
            error={error}
          />

          <div>
            <label className="block text-sm font-medium text-[#6D7480] mb-3">
              Property Type (Optional)
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['residential', 'hospitality', 'commercial'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPropertyType(type)}
                  className={`
                    px-4 py-3 rounded-xl text-sm font-medium capitalize
                    transition-all duration-150 ease-out
                    ${propertyType === type 
                      ? 'text-[#FF6B6B]' 
                      : 'text-[#6D7480] hover:text-[#1C1C1C]'
                    }
                  `}
                  style={{
                    boxShadow: propertyType === type
                      ? "inset 2px 2px 4px rgba(255,107,107,0.15), inset -2px -2px 4px rgba(255,255,255,0.7)"
                      : "inset 1px 1px 3px rgba(0,0,0,0.08), inset -1px -1px 3px rgba(255,255,255,0.7)"
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {orgSlug && (
            <div className="p-4 rounded-xl bg-[#F6F4F2]" style={{
              boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.06), inset -2px -2px 4px rgba(255,255,255,0.5)"
            }}>
              <p className="text-xs text-[#6D7480] mb-1">Your organisation URL</p>
              <p className="text-sm text-[#1C1C1C] font-mono">{orgSlug}</p>
            </div>
          )}

          <div className="pt-4">
            <NeomorphicButton
              variant="primary"
              onClick={handleCreate}
              disabled={loading || !orgName.trim()}
            >
              {loading ? "Creating..." : "Continue"}
            </NeomorphicButton>
          </div>
        </div>
      </div>
    </OnboardingContainer>
  );
}
