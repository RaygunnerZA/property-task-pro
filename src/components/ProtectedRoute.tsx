import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useDataContext } from "@/contexts/DataContext";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: ReactNode;
  requireOrg?: boolean;
}

/** Onboarding completed when owner setup finishes (home) or staff /onboarding/staff continues. */
function getOnboardingCompleted(
  session: { user?: { user_metadata?: Record<string, unknown> } } | null,
  orgId: string | null
): boolean {
  const completed = session?.user?.user_metadata?.onboarding_completed;
  if (completed === true) return true;
  // Backwards compat: existing users with org but no flag are treated as completed
  if (completed == null && orgId) return true;
  return false;
}

/** Invited staff/contractors: have org, role is not owner or manager. */
function isInvitedStaffRole(role: string | null): boolean {
  if (!role) return false;
  return role !== "owner" && role !== "manager";
}

export function ProtectedRoute({ children, requireOrg = true }: ProtectedRouteProps) {
  const { isAuthenticated, loading, session } = useDataContext();
  const { orgId, role: memberRole, isLoading: orgLoading } = useActiveOrg();
  const [checkingProperties, setCheckingProperties] = useState(false);
  const [hasProperties, setHasProperties] = useState<boolean | null>(null);

  const onboardingCompleted = getOnboardingCompleted(session, orgId);
  const isInvitedStaff = !!orgId && isInvitedStaffRole(memberRole);

  // Check if user has properties when they have an org
  useEffect(() => {
    if (!orgId || loading || orgLoading) return;
    setCheckingProperties(true);
    void Promise.resolve(
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
    ).then(({ count, error }) => {
      if (!error) setHasProperties((count ?? 0) > 0);
      else setHasProperties(true);
    }).finally(() => setCheckingProperties(false));
  }, [orgId, loading, orgLoading]);

  const showSkeleton = loading || orgLoading || checkingProperties;

  if (showSkeleton) {
    return <ProtectedRouteSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace />;
  }

  // Role-aware onboarding: do not block on !orgId alone
  if (requireOrg && !onboardingCompleted) {
    if (isInvitedStaff) {
      return <Navigate to="/onboarding/staff" replace />;
    }
    return <Navigate to="/onboarding/property-profile" replace />;
  }

  // If onboarding complete, allow access even if org hydration is still pending

  // Nudge owners/managers with org but no properties to add one (not staff)
  if (
    requireOrg &&
    orgId &&
    hasProperties === false &&
    !isInvitedStaff
  ) {
    const currentPath = window.location.pathname;
    if (!currentPath.startsWith("/onboarding")) {
      return <Navigate to="/onboarding/add-property" replace />;
    }
  }

  return <>{children}</>;
}

function ProtectedRouteSkeleton() {
  return (
    <div className="min-h-screen bg-[#F6F4F2] flex items-center justify-center">
      <div className="text-center">
        <Skeleton className="h-8 w-48 mx-auto mb-4" />
        <p className="text-lg text-[#6D7480]">Loading Filla...</p>
      </div>
    </div>
  );
}
