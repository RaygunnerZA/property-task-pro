import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Root index page — responsible only for routing.
 *
 * Special case: Supabase invitation / magic-link emails redirect here
 * when the `redirectTo` URL hasn't been added to the Supabase Auth
 * "Redirect URLs" allowlist.  In that situation Supabase still appends
 * `#access_token=...&type=invite` to the hash.  We detect those tokens
 * here and forward the user to /accept-invitation so the proper flow runs.
 */
const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      // ── Detect Supabase hash tokens (invite / magic-link) ──────────────────
      // When the Site URL is the app root and redirectTo is ignored, Supabase
      // still appends auth tokens to the hash.  Forward to accept-invitation.
      if (window.location.hash) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const hashType = params.get("type");
        const hashToken = params.get("access_token");
        const hashError = params.get("error");

        if (hashError) {
          // Expired/invalid link — clear hash and fall through to normal routing
          window.history.replaceState({}, "", "/");
        } else if (hashToken && (hashType === "invite" || hashType === "magiclink")) {
          // Invitation or magic-link — forward to acceptance page preserving hash
          const pendingToken = sessionStorage.getItem("pending_invitation_token");
          const dest = pendingToken
            ? `/accept-invitation?token=${pendingToken}`
            : "/accept-invitation";
          navigate(dest + window.location.hash, { replace: true });
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/welcome");
        return;
      }

      // ── Check org membership ────────────────────────────────────────────────
      const { data: memberData } = await supabase
        .from("organisation_members")
        .select("org_id")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();

      if (memberData?.org_id) {
        navigate("/work/tasks");
        return;
      }

      // ── No org yet — check for a pending invitation before creating one ─────
      // Handles the case where the user was just created via inviteUserByEmail
      // but the acceptance hasn't run yet (e.g. redirectTo URL wasn't allowlisted).
      if (session.user.email) {
        const { data: invite } = await supabase
          .from("invitations")
          .select("token")
          .eq("email", session.user.email.toLowerCase())
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (invite?.token) {
          navigate(`/accept-invitation?token=${invite.token}`, { replace: true });
          return;
        }
      }

      // Also check sessionStorage for a token stashed before login
      const storedToken = sessionStorage.getItem("pending_invitation_token");
      if (storedToken) {
        navigate(`/accept-invitation?token=${storedToken}`, { replace: true });
        return;
      }

      // Genuinely new user with no invitation — go to org creation
      navigate("/onboarding/create-organisation");
    };

    checkAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F4F2]">
      <div className="text-center">
        <p className="text-xl text-[#6D7480]">Loading…</p>
      </div>
    </div>
  );
};

export default Index;
