import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "../integrations/supabase/types";
import { useDataContext } from "@/contexts/DataContext";

type SignalRow = Tables<"signals">;

export function useReminders() {
  const { orgId } = useDataContext();
  const [reminders, setReminders] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchReminders() {
    if (!orgId) {
      setReminders([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("signals")
      .select("*")
      .eq("type", "reminder")
      .order("due_at", { ascending: true });

    if (err) setError(err.message);
    else setReminders(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchReminders();
  }, [orgId]);

  return { reminders, loading, error, refresh: fetchReminders };
}
