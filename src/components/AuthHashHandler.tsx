import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Handles auth tokens in the URL hash on app load.
 * Supabase email confirmation can redirect to the Site URL (e.g. /) with hash
 * instead of /verify. If we only parse the hash on /verify, users landing on /
 * never get a session and see "Create your Organisation" then "Please sign in".
 * This runs on any route and sets the session before any auth-gated logic runs.
 */
export function AuthHashHandler() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const hash = window.location.hash;
    if (!hash) return;

    try {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if ((type === "signup" || type === "magiclink") && accessToken) {
        handled.current = true;
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken || "" })
          .then(({ error }) => {
            if (error) {
              handled.current = false;
              return;
            }
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
            toast.success("Email verified!");
            navigate("/onboarding/create-organisation", { replace: true });
          });
      }
    } catch {
      // Ignore parse errors
    }
  }, [navigate]);

  return null;
}
