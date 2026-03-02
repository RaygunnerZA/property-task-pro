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
 */
export function AuthHashHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const handled = useRef(false);

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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e1a6'},body:JSON.stringify({sessionId:'96e1a6',runId:'invite-inherit-baseline',hypothesisId:'H1',location:'AuthHashHandler.tsx:parseHash',message:'global hash handler parsed auth hash',data:{path:location.pathname,search:location.search,type,hasAccessToken:!!accessToken,hasRefreshToken:!!refreshToken,onAcceptInvitationRoute,hasInviteToken},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if ((type === "signup" || type === "magiclink") && accessToken) {
        handled.current = true;
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken || "" })
          .then(({ error }) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e1a6'},body:JSON.stringify({sessionId:'96e1a6',runId:'invite-inherit-baseline',hypothesisId:'H1',location:'AuthHashHandler.tsx:setSessionResult',message:'global hash handler setSession result',data:{hasError:!!error,error:error?.message ?? null},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
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
