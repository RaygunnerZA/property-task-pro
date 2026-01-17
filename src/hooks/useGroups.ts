import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";
import { ENABLE_GROUPS_FEATURE } from "@/lib/featureFlags";

type GroupRow = Tables<"groups">;

export function useGroups() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchGroups() {
    if (!ENABLE_GROUPS_FEATURE) {
      setGroups([]);
      setLoading(false);
      setError(null);
      return;
    }
    if (!orgId) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("groups")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_archived", false)
      .order("display_order", { ascending: true });

    // 404 is expected if groups table doesn't exist or has no data - don't treat as error
    if (err) {
      if (err.code === 'PGRST116' || err.status === 404 || err.message?.includes('404')) {
        setGroups([]);
        setError(null);
      } else {
        setError(err.message);
      }
    } else {
      setGroups(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchGroups();
    }
  }, [orgId, orgLoading]);

  return { groups, loading, error, refresh: fetchGroups };
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
