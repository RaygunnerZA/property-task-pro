import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDataContext } from "@/providers/DataProvider";
import { supabase } from "@/integrations/supabase/client";

export function AppInitializer({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, orgId, loading } = useDataContext();

  useEffect(() => {
    if (loading) return;

    const publicRoutes = ["/welcome", "/signup", "/login", "/verify"];
    const onboardingRoutes = [
      "/onboarding/create-organisation",
      "/onboarding/add-property",
      "/onboarding/invite-team",
      "/onboarding/preferences",
      "/onboarding/complete",
    ];

    const isPublicRoute = publicRoutes.includes(location.pathname);
    const isOnboardingRoute = onboardingRoutes.includes(location.pathname);

    // Not authenticated
    if (!isAuthenticated) {
      if (!isPublicRoute && !isOnboardingRoute) {
        navigate("/welcome", { replace: true });
      }
      return;
    }

    // Authenticated but no org - needs onboarding
    if (!orgId) {
      if (!isOnboardingRoute) {
        navigate("/onboarding/create-organisation", { replace: true });
      }
      return;
    }

    // Authenticated with org - redirect from public/onboarding routes
    if (isPublicRoute || isOnboardingRoute) {
      navigate("/work/tasks", { replace: true });
      return;
    }
  }, [isAuthenticated, orgId, loading, location.pathname, navigate]);

  return <>{children}</>;
}
