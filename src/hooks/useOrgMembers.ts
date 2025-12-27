import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";

export interface OrgMember {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  email: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

export function useOrgMembers() {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchMembers() {
    if (!orgId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch memberships
      const { data: memberships, error: err } = await supabase
        .from("organisation_members")
        .select("id, user_id, role")
        .eq("org_id", orgId);

      if (err) {
        setError(err.message);
        setMembers([]);
        setLoading(false);
        return;
      }

      if (!memberships || memberships.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // Fetch user data via RPC function
      const userIds = memberships.map(m => m.user_id);
      const { data: userData, error: userError } = await supabase.rpc(
        'get_users_info',
        { user_ids: userIds }
      );

      if (userError) {
        console.error("Error fetching user info:", userError);
        // Fallback to basic info if RPC fails
        const mapped: OrgMember[] = memberships.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          display_name: `User ${m.user_id.slice(0, 8)}`,
          email: null,
          nickname: null,
          avatar_url: null,
        }));
        setMembers(mapped);
        setLoading(false);
        return;
      }

      // Map members with user data
      const mapped: OrgMember[] = memberships.map((m) => {
        const user = userData?.find((u: any) => u.id === m.user_id);
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          display_name: user?.nickname || user?.email || `User ${m.user_id.slice(0, 8)}`,
          email: user?.email || null,
          nickname: user?.nickname || null,
          avatar_url: user?.avatar_url || null,
        };
      });

      setMembers(mapped);
    } catch (err: any) {
      setError(err.message || "Failed to fetch members");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchMembers();
    }
  }, [orgId, orgLoading]);

  return { members, loading, error, refresh: fetchMembers };
}
