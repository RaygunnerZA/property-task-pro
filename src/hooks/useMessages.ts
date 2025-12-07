import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "../integrations/supabase/types";
import { useDataContext } from "@/contexts/DataContext";

type MessageRow = Tables<"messages">;

export function useMessages() {
  const { orgId } = useDataContext();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchMessages() {
    if (!orgId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (err) setError(err.message);
    else setMessages(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchMessages();
  }, [orgId]);

  return { messages, loading, error, refresh: fetchMessages };
}
