import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "../integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface Message {
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
 * Hook to fetch messages for a task.
 * 
 * Automatically finds or creates a conversation for the task, then fetches messages.
 * Uses TanStack Query for caching, automatic refetching, and error handling.
 * 
 * @param taskId - The task ID to fetch messages for
 * @returns Messages array, loading state, error state, and refresh function
 */
export function useTaskMessages(taskId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const { data: messages = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: queryKeys.taskMessages(orgId ?? undefined, taskId),
    queryFn: async (): Promise<Message[]> => {
      if (!orgId || !taskId) {
        return [];
      }

      // First, find or create conversation for this task
      // This is idempotent - if conversation exists, we use it; if not, we create it
      let { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .eq("org_id", orgId)
        .eq("task_id", taskId)
        .maybeSingle();

      if (convError && convError.code !== "PGRST116") {
        // PGRST116 is "not found" which is expected when conversation doesn't exist yet
        throw convError;
      }

      let conversationId: string | null = null;

      if (!conversation) {
        // Create conversation if it doesn't exist (auto-creation pattern)
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

      // Fetch messages for this conversation
      const { data, error: err } = await supabase
        .from("messages")
        .select("*")
        .eq("org_id", orgId)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (err) {
        throw err;
      }

      return (data as Message[]) ?? [];
    },
    enabled: !!orgId && !!taskId && !orgLoading, // Only fetch when we have orgId and taskId
    staleTime: 30 * 1000, // 30 seconds - messages are relatively fresh data
    retry: 1, // Retry once on error
  });

  // Wrapper for backward compatibility - old refresh() was async and could be awaited
  const refresh = async () => {
    await refetch();
  };

  return {
    messages,
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh,
  };
}
