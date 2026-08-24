import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Platform-admin gate for /admin/*.
 * Prefer `is_platform_admin()` RPC; fall back to self-select on `platform_admins`.
 * Errors stay as errors (do not treat as "not admin") so AdminLayout can show a
 * failure state instead of silently bouncing to home.
 */
export function useIsPlatformAdmin() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["platform-admin-check", user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user?.id) return false;

      const rpc = await supabase.rpc("is_platform_admin");
      if (!rpc.error) return Boolean(rpc.data);

      // Fallback when RPC is missing from schema cache / older environments.
      const { data, error } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data !== null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
