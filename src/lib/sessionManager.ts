import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for session reads + subscriptions.
 *
 * IMPORTANT:
 * - Never calls refreshSession() (no silent refreshes)
 * - Relies on Supabase client config (autoRefreshToken) for lifecycle
 */

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    // Treat as "no session" for stability; callers can decide how to handle null.
    return null;
  }
  return data.session ?? null;
}

export function subscribeToSession(onSession: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onSession(session);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

