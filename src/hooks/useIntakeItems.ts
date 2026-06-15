import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { IntakeItem, IntakeItemStatus } from "@/types/intake-item";

export const INTAKE_ITEMS_QUERY_KEY = "intake_items";

export function useIntakeItems(status?: IntakeItemStatus | IntakeItemStatus[]) {
  const { orgId } = useActiveOrg();

  return useQuery({
    queryKey: [INTAKE_ITEMS_QUERY_KEY, orgId, status],
    enabled: Boolean(orgId),
    queryFn: async (): Promise<IntakeItem[]> => {
      if (!orgId) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("intake_items")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (status) {
        const statuses = Array.isArray(status) ? status : [status];
        query = query.in("status", statuses);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as IntakeItem[];
    },
    refetchInterval: (query) => {
      const items = query.state.data ?? [];
      const hasInFlight = items.some((item) =>
        item.status === "pending" || item.status === "processing"
      );
      return hasInFlight ? 3000 : false;
    },
  });
}

export function useIntakeItemsInvalidator() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [INTAKE_ITEMS_QUERY_KEY] });
}
