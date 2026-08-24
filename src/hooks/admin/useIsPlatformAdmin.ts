import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Platform-admin gate for /admin/*.
 * Single source of truth: `is_platform_admin()` RPC (SECURITY DEFINER).
 * Fail closed on RPC errors — do not fall back to a direct table read.
 */
export function useIsPlatformAdmin() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["platform-admin-check", user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user?.id) return false;

      const { data, error } = await supabase.rpc("is_platform_admin");
      if (error) throw error;
      return Boolean(data);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
