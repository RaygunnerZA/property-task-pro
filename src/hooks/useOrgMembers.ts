import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";

export interface OrgMember {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
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

    const { data, error: err } = await supabase
      .from("organisation_members")
      .select("id, user_id, role")
      .eq("org_id", orgId);

    if (err) {
      setError(err.message);
      setMembers([]);
    } else {
      // Map to OrgMember with display_name fallback
      const mapped: OrgMember[] = (data ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        display_name: `User ${m.user_id.slice(0, 8)}`, // Fallback display name
      }));
      setMembers(mapped);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchMembers();
    }
  }, [orgId, orgLoading]);

  return { members, loading, error, refresh: fetchMembers };
}
