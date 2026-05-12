import { useEffect, useState } from "react";
import { supabase as _supabase } from "@/integrations/supabase/client";
import type { SignalRow } from "@/types/database";
// signals is a pending-migration table — cast until schema is generated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
import { useActiveOrg } from "./useActiveOrg";

export function useReminders() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
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
      .eq("org_id", orgId)
      .eq("type", "reminder")
      .order("due_at", { ascending: true });

    if (err) setError(err.message);
    else setReminders(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchReminders();
    }
  }, [orgId, orgLoading]);

  return { reminders, loading, error, refresh: fetchReminders };
}
