import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useDataContext } from "@/contexts/DataContext";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: ReactNode;
  requireOrg?: boolean;
}

export function ProtectedRoute({ children, requireOrg = true }: ProtectedRouteProps) {
  const { isAuthenticated, orgId, loading } = useDataContext();
  const [checkingProperties, setCheckingProperties] = useState(false);
  const [hasProperties, setHasProperties] = useState<boolean | null>(null);

  // Check if user has properties when they have an org
  useEffect(() => {
    async function checkProperties() {
      if (!orgId || loading) return;
      
      setCheckingProperties(true);
      try {
        const { count, error } = await supabase
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId);
        
        if (!error) {
          setHasProperties((count ?? 0) > 0);
        }
      } catch (err) {
        console.error("Error checking properties:", err);
        // Default to true to avoid false redirects
        setHasProperties(true);
      } finally {
        setCheckingProperties(false);
      }
    }
    
    checkProperties();
  }, [orgId, loading]);

  if (loading || checkingProperties) {
    return <ProtectedRouteSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace />;
  }

  // TEMPORARILY DISABLED: Allow access even without orgId to break redirect loop
  // if (requireOrg && !orgId) {
  //   return <Navigate to="/onboarding/create-organisation" replace />;
  // }

  // Only redirect to add property if we've confirmed there are no properties
  // AND we're not already on an onboarding route
  if (requireOrg && orgId && hasProperties === false) {
    // Don't redirect if already on onboarding routes
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
