import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataContext } from "@/contexts/DataContext";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useInitialOrgQueries } from "@/hooks/use-initial-org-queries";
import { supabase } from "@/integrations/supabase/client";

export function AppBootLoader({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { loading: authLoading } = useDataContext();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { isLoading: dataLoading } = useInitialOrgQueries(orgId);

  // Prefetch tasks and properties as soon as orgId is available
  useEffect(() => {
    if (!orgId || orgLoading) return;

    // Prefetch tasks
    queryClient.prefetchQuery({
      queryKey: ["tasks", orgId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("tasks_view")
          .select("*")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data ?? [];
      },
      staleTime: 60000, // 1 minute
    });

    // Prefetch properties
    queryClient.prefetchQuery({
      queryKey: ["properties", orgId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("properties_view")
          .select("*")
          .eq("org_id", orgId);

        if (error) throw error;
        return data ?? [];
      },
      staleTime: 60000, // 1 minute
    });
  }, [orgId, orgLoading, queryClient]);

  // Only block for auth or org loading - let data load in background
  const isLoading = authLoading || orgLoading;

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