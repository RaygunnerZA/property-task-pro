import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader, OnboardingLogoutButton } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";
import { useDataContext } from "@/contexts/DataContext";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { getCurrentStep } from "@/utils/onboardingSteps";
import { toast } from "sonner";

export default function CreateOrganisationScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orgName, setOrgName, setOrgId } = useOnboardingStore();
  const { refresh, session } = useDataContext();
  const { orgId: activeOrgId, isLoading: orgLoading } = useActiveOrg();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If user already has an org, skip this step to avoid "create org" then "you have an org" confusion
  const hasOrgAndRedirecting = !orgLoading && !!activeOrgId;
  useEffect(() => {
    if (!hasOrgAndRedirecting) return;
    navigate("/onboarding/add-property", { replace: true });
  }, [hasOrgAndRedirecting, navigate]);

  // Don't show the form until we've finished the org check – avoids showing "Create org" then redirecting
  if (orgLoading) {
    return (
      <OnboardingContainer topRight={<OnboardingLogoutButton />}>
        <div className="animate-fade-in flex min-h-[200px] items-center justify-center">
          <p className="text-[#6D7480]">Checking your account…</p>
        </div>
      </OnboardingContainer>
    );
  }

  const handleCreate = async () => {
    if (!orgName.trim()) {
      setError("Organisation name is required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Verify we have a valid session and refresh it to ensure fresh JWT
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !currentSession?.user) {
        toast.error("Please sign in to continue");
        navigate("/login");
        return;
      }

      const currentUserId = currentSession.user.id;

      // Check if user already has an organisation
      // Use a direct query with explicit user_id check to ensure RLS is working
      const { data: existingMemberships, error: membershipError } = await supabase
        .from('organisation_members')
        .select('org_id, organisations!inner(id, name, created_by)')
        .eq('user_id', currentUserId)
        .limit(1);

      if (membershipError) {
        console.error("Error checking existing memberships:", membershipError);
        console.error("Membership error details:", {
          message: membershipError.message,
          code: membershipError.code,
          details: membershipError.details,
          hint: membershipError.hint
        });
      } else if (existingMemberships && existingMemberships.length > 0) {
        const membership = existingMemberships[0];
        const existingOrgId = membership.org_id;
        const org = membership.organisations;
        
        // Verify the org actually belongs to this user
        if (org && org.created_by === currentUserId) {
          toast.info("You already have an organisation. Taking you to the next step.");
          // Redirect to property page instead
          setTimeout(() => {
            navigate("/onboarding/add-property", { replace: true });
          }, 1000);
          setLoading(false);
          return;
        } else {
          // This shouldn't happen if RLS is working correctly, but log it
          console.warn("Found membership but org doesn't belong to user:", {
            membership,
            org,
            currentUserId
          });
        }
      }

      // Note: Duplicate check is now handled by the backend create_organisation function
      // which is more reliable and respects org_type differences

      // Verify the user ID matches what auth.uid() will return
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || authUser.id !== currentUserId) {
        toast.error("Session verification failed. Please try again.");
        return;
      }

      // Verify session one more time right before insert
      const { data: { user: verifyUser } } = await supabase.auth.getUser();
      if (!verifyUser) {
        toast.error("Session expired. Please sign in again.");
        navigate("/login");
        return;
      }

      // Use SECURITY DEFINER function to bypass RLS for org creation
      const { data: orgId, error: orgError } = await supabase.rpc('create_organisation', {
        org_name: orgName,
        org_type_value: 'business',
        creator_id: currentUserId
      });

      if (orgError) {
        console.error("Org creation error:", orgError);
        console.error("Error details:", {
          message: orgError.message,
          details: orgError.details,
          hint: orgError.hint,
          code: orgError.code
        });
        throw orgError;
      }

      if (!orgId) {
        throw new Error("Failed to create organisation: no ID returned");
      }

      // Note: Membership is now created automatically by the RPC function

      // Store in local onboarding state
      setOrgId(orgId);

      // Wait a moment for the database to be ready, then refresh
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh session to get fresh JWT (though org_id won't be in JWT yet)
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error("Session refresh error:", refreshError);
      }
      
      // Refresh DataContext (it will use useActiveOrg which fetches from DB)
      await refresh();
      
      toast.success("Organisation created!");
      
      // Small delay so success toast is visible, then continue
      setTimeout(() => {
        navigate("/onboarding/add-property");
      }, 100);
    } catch (err: any) {
      console.error("Create org failed:", err);
      toast.error(err.message || "Failed to create organisation");
    } finally {
      setLoading(false);
    }
  };

  // Brief message while redirecting when user already has an org
  if (hasOrgAndRedirecting) {
    return (
      <OnboardingContainer topRight={<OnboardingLogoutButton />}>
        <div className="animate-fade-in flex min-h-[200px] items-center justify-center">
          <p className="text-[#6D7480]">Taking you to the next step…</p>
        </div>
      </OnboardingContainer>
    );
  }

  return (
    <OnboardingContainer topRight={<OnboardingLogoutButton />}>
      <div className="animate-fade-in">
        <ProgressDots current={getCurrentStep(location.pathname)} />
        
        <OnboardingHeader
          title="Create your organisation"
          showLogout={false}
          subtitle="Give your team a home"
          showBack
          onBack={() => navigate("/login")}
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
