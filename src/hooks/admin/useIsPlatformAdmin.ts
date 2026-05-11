import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";

export function useIsPlatformAdmin() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["platform-admin-check", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_admins")
        .select("user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) return false;
      return data !== null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}
