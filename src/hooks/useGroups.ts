import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";

/** Groups are stored as themes with type='group' (groups table was replaced by themes in migration 20251220000032). */
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
        .from("themes")
        .select("id, name, color, icon, type, org_id, created_at, updated_at")
        .eq("org_id", orgId)
        .eq("type", "group")
        .order("name", { ascending: true });
      if (err) throw err;
      return (data ?? []) as GroupRow[];
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 5 * 60 * 1000,
  });

  return {
    groups,
    loading,
    error: queryError ? (queryError as Error).message : null,
    refresh: refetch,
  };
}

/** group_members table was removed in themes migration; kept for API compatibility, returns empty. */
export function useGroupMembers(groupId?: string) {
  const [members, setMembers] = useState<{ id: string; group_id?: string; user_id?: string; is_deleted?: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMembers([]);
    setLoading(false);
  }, [groupId]);

  return { members, loading, error, refresh: () => {} };
}

/** task_groups was replaced by task_themes (migration 20251220000032). */
export function useTaskGroups(taskId?: string) {
  const [taskGroups, setTaskGroups] = useState<Tables<"task_themes">[]>([]);
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
      .from("task_themes")
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
