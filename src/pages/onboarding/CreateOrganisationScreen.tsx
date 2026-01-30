import { useState } from "react";
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

  // Debug: Log orgId state
  console.log('[CreateOrganisationScreen] Render', { activeOrgId, orgLoading });

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
      console.log("Creating org for user:", currentUserId);

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
          console.log("User already has an organisation:", existingOrgId);
          toast.error("You already have an organisation. Redirecting...");
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

      console.log("About to create org with:", {
        name: orgName,
        org_type: 'business',
        created_by: currentUserId,
        auth_uid: verifyUser.id
      });

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

      console.log("Org created with membership:", orgId);
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
      
      // Mark that we're navigating from onboarding to prevent AppInitializer interference
      (window as any).__lastOnboardingNavigation = Date.now();
      
      // Small delay to ensure state is updated before navigation
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
          {/* Organization Found Banner */}
          {!orgLoading && activeOrgId && (
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 mb-4">
              <p className="text-green-800 font-semibold mb-4 text-center">
                Organization Found! You already have an organization.
              </p>
              <p className="text-green-700 text-sm mb-4 text-center font-mono">
                Org ID: {activeOrgId}
              </p>
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[CreateOrganisationScreen] Skip to dashboard clicked - FORCING NAVIGATION', { activeOrgId, currentPath: location.pathname });
                  // Force full page reload to bypass all route guards
                  window.location.href = "/";
                }}
                className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold py-4 px-6 rounded-lg shadow-lg transition-colors duration-200 cursor-pointer block text-center"
              >
                Organization Found! Skip to Dashboard
              </a>
            </div>
          )}

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

          {/* Dev Bypass Link */}
          <div className="pt-4 text-center">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[CreateOrganisationScreen] Dev bypass clicked - FORCING NAVIGATION');
                // Force full page reload to bypass all route guards
                window.location.href = "/";
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer"
            >
              Force Go to Dashboard (Dev Bypass)
            </a>
          </div>
        </div>
      </div>
    </OnboardingContainer>
  );
}
