import { useQuery } from "@tanstack/react-query";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";

export interface Vendor {
  id: string;
  org_id: string;
  name: string;
  email: string;
  phone: string;
}

export const useVendor = (vendorId?: string) => {
  const { userId, orgId } = useDataContext();
  const targetId = vendorId ?? userId;

  const { data: vendor = null, isLoading } = useQuery({
    queryKey: ["vendor-profile", targetId, orgId],
    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) throw error ?? new Error("Not authenticated");

      const meta = user.user_metadata ?? {};

      return {
        id: user.id,
        org_id: orgId ?? "",
        name:
          meta.full_name ??
          meta.name ??
          [meta.first_name, meta.last_name].filter(Boolean).join(" ") ||
          user.email?.split("@")[0] ??
          "Vendor",
        email: user.email ?? "",
        phone: meta.phone ?? "",
      } satisfies Vendor;
    },
    enabled: !!targetId,
    staleTime: 300000,
  });

  return { vendor, isLoading };
};
