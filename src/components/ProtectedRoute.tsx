import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useDataContext } from "@/contexts/DataContext";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: ReactNode;
  requireOrg?: boolean;
}

/** Onboarding completed is set only at /onboarding/complete (or staff /onboarding/staff). */
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
  const { isAuthenticated, orgId, loading, session, user } = useDataContext();
  const userId = user?.id ?? null;
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [memberRoleLoading, setMemberRoleLoading] = useState(false);
  const [checkingProperties, setCheckingProperties] = useState(false);
  const [hasProperties, setHasProperties] = useState<boolean | null>(null);

  const onboardingCompleted = getOnboardingCompleted(session, orgId);
  const isInvitedStaff = !!orgId && isInvitedStaffRole(memberRole);

  // Fetch member role when user has an org (for role-aware onboarding)
  useEffect(() => {
    if (!orgId || !userId) {
      setMemberRole(null);
      setMemberRoleLoading(false);
      return;
    }
    let cancelled = false;
    setMemberRoleLoading(true);
    supabase
      .from("organisation_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setMemberRole(data.role ?? null);
        else setMemberRole(null);
      })
      .finally(() => {
        if (!cancelled) setMemberRoleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, userId]);

  // Check if user has properties when they have an org
  useEffect(() => {
    if (!orgId || loading) return;
    setCheckingProperties(true);
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .then(({ count, error }) => {
        if (!error) setHasProperties((count ?? 0) > 0);
        else setHasProperties(true);
      })
      .finally(() => setCheckingProperties(false));
  }, [orgId, loading]);

  const needRoleForRedirect = !onboardingCompleted && !!orgId;
  const showSkeleton =
    loading ||
    checkingProperties ||
    (needRoleForRedirect && memberRoleLoading);

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
    return <Navigate to="/onboarding/create-organisation" replace />;
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
      <div className="w-full max-w-md space-y-4 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
