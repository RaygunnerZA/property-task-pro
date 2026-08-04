import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { toErrorMessage } from "@/lib/error";

export interface TaskMessage {
  id: string;
  org_id: string;
  conversation_id: string;
  author_name: string | null;
  author_role: string | null;
  author_user_id: string | null;
  body: string;
  created_at: string;
}

/**
 * Read-only fetch for task Activity messages.
 * Does not create conversations — create happens on send in TaskMessaging.
 */
async function fetchTaskMessages(orgId: string, taskId: string): Promise<TaskMessage[]> {
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("org_id", orgId)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (convError) {
    throw convError;
  }

  if (!conversation?.id) {
    return [];
  }

  const { data, error: err } = await supabase
    .from("messages")
    .select("*")
    .eq("org_id", orgId)
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (err) {
    throw err;
  }

  return (data as TaskMessage[]) ?? [];
}

export function useTaskMessages(taskId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["task-messages", orgId, taskId],
    queryFn: () => fetchTaskMessages(orgId!, taskId!),
    enabled: !!orgId && !!taskId && !orgLoading,
    staleTime: 30_000,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["task-messages", orgId, taskId] });
  }, [queryClient, orgId, taskId]);

  return {
    messages: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? toErrorMessage(query.error, "Couldn't load messages") : null,
    refresh,
  };
}
