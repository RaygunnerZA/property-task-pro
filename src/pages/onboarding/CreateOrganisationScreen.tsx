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
  const { orgName, orgSlug, setOrgName, setOrgId } = useOnboardingStore();
  
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

          <div className="text-center">
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
