import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "./useActiveOrg";

/** Groups table may not exist (404); use minimal row type */
interface GroupRow {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export function useGroups() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: groups = [], isLoading: loading, error: queryError, refetch } = useQuery({
    queryKey: ["groups", orgId],
    queryFn: async (): Promise<GroupRow[]> => {
      if (!orgId) return [];
      const { data, error: err } = await supabase
        .from("groups")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_archived", false)
        .order("display_order", { ascending: true });
      // 404/PGRST205 = table doesn't exist - treat as empty; PGRST116 = no rows
      if (err && (err.code === "PGRST205" || err.code === "PGRST116" || err.message?.includes("404"))) {
        return [];
      }
      if (err) throw err;
      return (data ?? []) as GroupRow[];
    },
    enabled: !!orgId && !orgLoading,
    retry: false, // Don't retry on 404 (table doesn't exist)
    staleTime: 5 * 60 * 1000, // Cache 5 min to avoid repeated 404s
  });

  return {
    groups,
    loading,
    error: queryError ? (queryError as Error).message : null,
    refresh: refetch,
  };
}

export function useGroupMembers(groupId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [members, setMembers] = useState<Tables<"group_members">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchMembers() {
    if (!orgId || !groupId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("group_members")
      .select("*")
      .eq("group_id", groupId)
      .eq("is_deleted", false);

    if (err) setError(err.message);
    else setMembers(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchMembers();
    }
  }, [orgId, groupId, orgLoading]);

  return { members, loading, error, refresh: fetchMembers };
}

export function useTaskGroups(taskId?: string) {
  const [taskGroups, setTaskGroups] = useState<Tables<"task_groups">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTaskGroups() {
    if (!taskId) {
      setTaskGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("task_groups")
      .select("*")
      .eq("task_id", taskId);

    if (err) setError(err.message);
    else setTaskGroups(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchTaskGroups();
  }, [taskId]);

  return { taskGroups, loading, error, refresh: fetchTaskGroups };
}
