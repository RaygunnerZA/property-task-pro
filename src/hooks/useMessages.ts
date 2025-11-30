import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import type { Tables } from "../integrations/supabase/types";

type MessageRow = Tables<"messages">;

export function useMessages(orgId?: string) {
  const supabase = useSupabase();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchMessages() {
    setLoading(true);
    setError(null);

    let query = supabase.from("messages").select("*").order("created_at", { ascending: false });

    if (orgId) query = query.eq("org_id", orgId);

    const { data, error: err } = await query;

    if (err) setError(err.message);
    else setMessages(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchMessages();
  }, [orgId]);

  return { messages, loading, error, refresh: fetchMessages };
}
