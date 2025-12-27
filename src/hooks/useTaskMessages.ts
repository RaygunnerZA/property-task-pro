import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "../integrations/supabase/client";

interface Message {
  id: string;
  org_id: string;
  conversation_id: string;
  author_name: string | null;
  author_role: string | null;
  author_user_id: string | null;
  body: string;
  created_at: string;
}

export function useTaskMessages(taskId: string | undefined) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!orgId || !taskId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First, find or create conversation for this task
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
        // Create conversation if it doesn't exist
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

      setMessages((data as Message[]) ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch messages");
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [orgId, taskId]);

  useEffect(() => {
    if (!orgLoading) {
      fetchMessages();
    }
  }, [fetchMessages, orgLoading]);

  return { messages, loading, error, refresh: fetchMessages };
}

