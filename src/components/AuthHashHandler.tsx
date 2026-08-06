import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Handles auth tokens in the URL hash on app load.
 * Supabase email confirmation can redirect to the Site URL (e.g. /) with hash
 * instead of /verify. If we only parse the hash on /verify, users landing on /
 * never get a session and see "Create your Organisation" then "Please sign in".
 * This runs on any route and sets the session before any auth-gated logic runs.
 *
 * Password recovery (`type=recovery`) must land on `/reset-password`, not login
 * or the authenticated app home.
 */
export function AuthHashHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const handled = useRef(false);

  // Catch recovery sessions established by detectSessionInUrl on any route.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "PASSWORD_RECOVERY") return;
      if (location.pathname === "/reset-password") return;
      navigate("/reset-password", { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (handled.current) return;
    const hash = window.location.hash;
    if (!hash) return;

    // Invitation acceptance has its own token/session handler in AcceptInvitation.
    // Avoid hijacking those flows into generic auth callback routing.
    const onAcceptInvitationRoute = location.pathname === "/accept-invitation";
    const hasInviteToken = new URLSearchParams(location.search).has("token");
    if (onAcceptInvitationRoute || hasInviteToken) return;

    try {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");

      if (!accessToken) return;

      if (type === "recovery") {
        handled.current = true;
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken || "" })
          .then(({ error }) => {
            if (error) {
              handled.current = false;
              toast.error(error.message || "Couldn't open reset link");
              return;
            }
            window.history.replaceState(null, "", "/reset-password");
            navigate("/reset-password", { replace: true });
          });
        return;
      }

      if (type === "signup" || type === "magiclink") {
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
            navigate("/auth/callback", { replace: true });
          });
      }
    } catch {
      // Ignore parse errors
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}
