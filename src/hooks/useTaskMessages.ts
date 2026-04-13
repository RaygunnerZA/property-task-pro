import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

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

async function fetchTaskMessages(orgId: string, taskId: string): Promise<TaskMessage[]> {
  let { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("org_id", orgId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (convError && convError.code !== "PGRST116") {
    throw convError;
  }

  let conversationId: string | null = null;

  if (!conversation) {
    const { data: newConv, error: createError } = await supabase
      .from("conversations")
      .insert({
        org_id: orgId,
        task_id: taskId,
        channel: "task",
        subject: `Task ${taskId}`,
      } as any)
      .select("id")
      .single();

    if (createError) {
      throw createError;
    }
    conversationId = newConv.id;
  } else {
    conversationId = conversation.id;
  }

  const { data, error: err } = await supabase
    .from("messages")
    .select("*")
    .eq("org_id", orgId)
    .eq("conversation_id", conversationId)
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

  const err = query.error;
  const errorMessage =
    err == null ? null : err instanceof Error ? err.message : String(err);

  return {
    messages: query.data ?? [],
    loading: query.isLoading,
    error: errorMessage,
    refresh,
  };
}
