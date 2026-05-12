/**
 * Property hub — assignees with work on this property (tasks with `assigned_user_id`).
 * Uses `tasks_view` + `organisation_members` for role labels (no invented columns).
 *
 * STATUS: Ready — not yet wired to UI.
 * Wire to the Vendors tab in PropertyIdentityStrip (Tier 3 — t3-property-hub).
 */
import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface PropertyVendorActivity {
  /** Display label: role + short user id (no PII from profiles in this v1). */
  vendorName: string;
  /** ISO timestamp of latest task update on this property, or empty if none. */
  lastVisit: string;
  tasksCompleted: number;
}

function roleLabel(role: string): string {
  const r = role.toLowerCase();
  if (r === "vendor") return "Vendor";
  if (r === "staff") return "Staff";
  if (r === "owner") return "Owner";
  if (r === "manager") return "Manager";
  if (r === "member") return "Member";
  return role;
}

type TaskRow = {
  id: string | null;
  assigned_user_id: string | null;
  status: string | null;
  updated_at: string | null;
};

export function usePropertyVendors(propertyId: string | undefined | null) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const query = useQuery({
    queryKey: ["property-vendors", orgId, propertyId],
    queryFn: async (): Promise<PropertyVendorActivity[]> => {
      if (!orgId || !propertyId) return [];

      const { data: taskRows, error: taskErr } = await supabase
        .from("tasks_view")
        .select("id, assigned_user_id, status, updated_at")
        .eq("org_id", orgId)
        .eq("property_id", propertyId)
        .not("assigned_user_id", "is", null);

      if (taskErr) throw taskErr;

      const tasks = (taskRows ?? []) as TaskRow[];
      const byUser = new Map<
        string,
        { completed: number; lastTs: number }
      >();

      for (const t of tasks) {
        const uid = t.assigned_user_id;
        if (!uid) continue;
        const cur = byUser.get(uid) ?? { completed: 0, lastTs: 0 };
        const st = (t.status ?? "").toLowerCase();
        if (st === "completed" || st === "archived") {
          cur.completed += 1;
        }
        const ts = t.updated_at ? new Date(t.updated_at).getTime() : 0;
        if (ts > cur.lastTs) cur.lastTs = ts;
        byUser.set(uid, cur);
      }

      const userIds = [...byUser.keys()];
      if (userIds.length === 0) return [];

      const { data: members, error: memErr } = await supabase
        .from("organisation_members")
        .select("user_id, role")
        .eq("org_id", orgId)
        .in("user_id", userIds);

      if (memErr) throw memErr;

      const roleByUser = new Map<string, string>();
      for (const m of members ?? []) {
        if (m.user_id) roleByUser.set(m.user_id, m.role ?? "member");
      }

      return userIds.map((uid) => {
        const agg = byUser.get(uid)!;
        const role = roleByUser.get(uid) ?? "member";
        const short = uid.slice(0, 8);
        return {
          vendorName: `${roleLabel(role)} · ${short}…`,
          lastVisit: agg.lastTs > 0 ? new Date(agg.lastTs).toISOString() : "",
          tasksCompleted: agg.completed,
        };
      });
    },
    enabled: !!orgId && !!propertyId && !orgLoading,
    staleTime: 60_000,
  });

  return {
    vendorActivity: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
