import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";
import { useDataContext } from "@/contexts/DataContext";
import { toast } from "sonner";

export default function CreateOrganisationScreen() {
  const navigate = useNavigate();
  const { orgName, orgSlug, setOrgName, setOrgId } = useOnboardingStore();
  const { refresh, session } = useDataContext();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!orgName.trim()) {
      setError("Organisation name is required");
      return;
    }

    setLoading(true);
    try {
      // Use session from context instead of fetching again
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

      // Update user metadata with org_id so JWT claims include it
      const { error: updateError } = await supabase.auth.updateUser({
        data: { org_id: org.id }
      });

      if (updateError) {
        console.error('Failed to update user metadata:', updateError);
        // Continue anyway - the trigger should have set it
      }

      // Store in local onboarding state
      setOrgId(org.id);
      
      // Refresh DataContext to pick up the new org_id
      await refresh();
      
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
