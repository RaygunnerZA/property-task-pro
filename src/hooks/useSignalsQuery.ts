import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { SignalRow } from "@/lib/signals/signalTypes";

export function useSignalsQuery(options?: {
  propertyIds?: string[];
  enabled?: boolean;
}) {
  const { orgId } = useActiveOrg();
  const propertyIds = options?.propertyIds;

  return useQuery({
    queryKey: ["signals", orgId, propertyIds?.join(",") ?? "all"],
    enabled: !!orgId && (options?.enabled ?? true),
    queryFn: async () => {
      if (!orgId) return [] as SignalRow[];

      const { data, error } = await supabase
        .from("signals" as "tasks")
        .select("*")
        .eq("org_id", orgId)
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(80);

      if (error) {
        if (error.code === "42P01" || error.message.includes("does not exist")) {
          return [] as SignalRow[];
        }
        throw error;
      }

      const rows = (data ?? []) as unknown as SignalRow[];
      const now = Date.now();
      return rows.filter((s) => {
        if (s.disposition === "dismissed") return false;
        if (s.disposition === "snoozed" && s.expires_at) {
          return new Date(s.expires_at).getTime() <= now;
        }
        if (propertyIds && propertyIds.length > 0 && s.property_id) {
          return propertyIds.includes(s.property_id);
        }
        return true;
      }).slice(0, 50);
    },
    staleTime: 30_000,
  });
}
