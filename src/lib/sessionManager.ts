import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { authManager } from "@/lib/auth/authManager";

/**
 * Single source of truth for session reads + subscriptions.
 *
 * IMPORTANT:
 * - Uses AuthManagerWithBlocker to prevent runaway refresh loops
 * - getSession() reads current session without refresh
 * - refreshSession() uses the protected manager to refresh safely
 * - Relies on Supabase client config (autoRefreshToken: false recommended) for manual control
 */

/**
 * Get current session without attempting refresh
 * Safe to call frequently - just reads from storage
 */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    // Treat as "no session" for stability; callers can decide how to handle null.
    return null;
  }
  return data.session ?? null;
}

/**
 * Refresh session using protected manager that prevents runaway loops
 * Automatically throttles, coalesces concurrent calls, and blocks when threshold exceeded
 */
export async function refreshSession(): Promise<Session | null> {
  return authManager.forceRefreshSession();
}

/**
 * Ensure session is fresh - refreshes only if token expires soon
 * Uses protected manager to prevent runaway loops
 */
export async function ensureFreshSession(): Promise<Session | null> {
  return authManager.ensureFreshSession();
}

export function subscribeToSession(onSession: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onSession(session);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}

