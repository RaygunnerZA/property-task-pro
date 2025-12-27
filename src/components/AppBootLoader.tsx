import { useDataContext } from "@/contexts/DataContext";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useInitialOrgQueries } from "@/hooks/use-initial-org-queries";

export function AppBootLoader({ children }: { children: React.ReactNode }) {
  // Keep data fetching logic - no automatic redirects
  const { loading: authLoading } = useDataContext();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { isLoading: dataLoading } = useInitialOrgQueries(orgId);

  const isLoading = authLoading || orgLoading || dataLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F4F2]">
        <div className="text-center">
          <p className="text-lg text-[#6D7480]">Loading Filla...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}