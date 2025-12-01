import { useEffect, useState } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import type { Tables } from "../integrations/supabase/types";

type SignalRow = Tables<"signals">;

export function useReminders(orgId?: string) {
  const supabase = useSupabase();
  const [reminders, setReminders] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchReminders() {
    setLoading(true);
    setError(null);

    let query = supabase.from("signals").select("*").eq("type", "reminder");

    if (orgId) query = query.eq("org_id", orgId);

    query = query.order("due_at", { ascending: true });

    const { data, error: err } = await query;

    if (err) setError(err.message);
    else setReminders(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchReminders();
  }, [orgId]);

  return { reminders, loading, error, refresh: fetchReminders };
}
