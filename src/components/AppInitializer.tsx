import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";

export function AppInitializer({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, orgId, loading } = useDataContext();
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);

  useEffect(() => {
    if (loading) return;

    const publicRoutes = ["/welcome", "/signup", "/login", "/verify"];
    const onboardingRoutes = [
      "/onboarding/create-organisation",
      "/onboarding/add-property",
      "/onboarding/add-space",
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

    // Authenticated with org - check if onboarding is complete (has at least one property)
    if (!isOnboardingRoute && !checkingOnboarding) {
      setCheckingOnboarding(true);
      
      const checkProperties = async () => {
        try {
          const { data } = await supabase
            .from('properties')
            .select('id')
            .eq('org_id', orgId)
            .limit(1);
          
          setCheckingOnboarding(false);
          
          // No properties = onboarding incomplete
          if (!data || data.length === 0) {
            navigate("/onboarding/add-property", { replace: true });
          } else if (isPublicRoute || location.pathname === "/onboarding/create-organisation") {
            // Has properties = onboarding complete, redirect from public routes
            navigate("/work/tasks", { replace: true });
          }
        } catch {
          setCheckingOnboarding(false);
        }
      };
      
      checkProperties();
      return;
    }

    // If on public route with completed onboarding, redirect to app
    if (isPublicRoute) {
      navigate("/work/tasks", { replace: true });
    }
  }, [isAuthenticated, orgId, loading, location.pathname, navigate, checkingOnboarding]);

  return <>{children}</>;
}
