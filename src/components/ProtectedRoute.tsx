import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useDataContext } from "@/providers/DataProvider";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: ReactNode;
  requireOrg?: boolean;
}

export function ProtectedRoute({ children, requireOrg = true }: ProtectedRouteProps) {
  const { isAuthenticated, orgId, loading } = useDataContext();

  if (loading) {
    return <ProtectedRouteSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/welcome" replace />;
  }

  if (requireOrg && !orgId) {
    return <Navigate to="/onboarding/create-organisation" replace />;
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
