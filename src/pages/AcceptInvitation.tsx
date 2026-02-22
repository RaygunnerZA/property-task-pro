/**
 * AcceptInvitation
 *
 * Handles the invitation acceptance flow for both new and existing users.
 *
 * Entry points:
 *   1. Supabase invitation email link:
 *      `/accept-invitation?token=...#access_token=...&type=invite`
 *      — Supabase sets the session via the hash tokens, then we call the RPC.
 *
 *   2. Magic link (existing users):
 *      `/accept-invitation?token=...#access_token=...&type=magiclink`
 *      — Same flow.
 *
 *   3. Unauthenticated with token:
 *      `/accept-invitation?token=...`
 *      — Redirect to /login?invite_token=... so user can authenticate first.
 *
 * Core fix: uses the `accept_invitation(token)` SECURITY DEFINER RPC which
 * atomically validates, inserts org membership with assigned_properties, and
 * marks the invitation accepted — bypassing all RLS edge cases.
 *
 * Cache fix: invalidates `["activeOrg"]` after acceptance so useActiveOrg
 * picks up the new membership immediately.
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { NeomorphicPasswordInput } from "@/components/onboarding/NeomorphicPasswordInput";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Lock } from "lucide-react";

type Status = "loading" | "password" | "success" | "error";

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

  // The invitation token is always in the ?token= query param.
  // Supabase appends #access_token=...&type=invite to the hash.
  const invitationToken =
    searchParams.get("token") ||
    sessionStorage.getItem("pending_invitation_token");

  useEffect(() => {
    if (status === "password") return; // Don't re-run while waiting for password

    const run = async () => {
      // ── Step 1: establish session from hash tokens (Supabase magic link / invite) ──
      const hash = window.location.hash;
      if (hash) {
        try {
          const params = new URLSearchParams(hash.substring(1));
          const hashAccessToken = params.get("access_token");
          const hashRefreshToken = params.get("refresh_token");
          const hashError = params.get("error");
          const hashErrorCode = params.get("error_code");

          if (hashError) {
            // Link expired — check if invitation is still valid via token
            if (hashErrorCode === "otp_expired" && invitationToken) {
              // Clear hash, redirect to login carrying the token
              window.history.replaceState({}, "", window.location.pathname + window.location.search);
              sessionStorage.setItem("pending_invitation_token", invitationToken);
              toast.info("The invitation link has expired — please sign in to continue.");
              navigate(`/login?invite_token=${invitationToken}`, { replace: true });
              return;
            }
            setStatus("error");
            setMessage(
              params.get("error_description") ||
                "The invitation link is invalid or has expired. Please request a new one."
            );
            return;
          }

          if (hashAccessToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: hashAccessToken,
              refresh_token: hashRefreshToken || "",
            });
            if (sessionError) {
              console.warn("[AcceptInvitation] setSession error:", sessionError.message);
            } else {
              // Clear hash from URL for cleanliness
              window.history.replaceState(
                {},
                "",
                window.location.pathname + window.location.search
              );
            }
          }
        } catch (err) {
          console.warn("[AcceptInvitation] hash parse error:", err);
        }
      }

      // Brief pause to let Supabase propagate the session
      await new Promise((r) => setTimeout(r, 500));

      // ── Step 2: get current user ──
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Not authenticated — redirect to login with token in URL
        if (invitationToken) {
          sessionStorage.setItem("pending_invitation_token", invitationToken);
          toast.info("Please sign in to accept your invitation.");
          navigate(`/login?invite_token=${invitationToken}`, { replace: true });
        } else {
          setStatus("error");
          setMessage("No invitation token found. Please use the link from your invitation email.");
        }
        return;
      }

      // ── Step 3: check if user needs to set a password ──
      // Newly invited users created by Supabase have no password yet.
      // We detect this by the absence of a password-based identity.
      const hasPasswordIdentity = user.identities?.some(
        (id) => id.provider === "email" && id.identity_data?.email_verified
      );
      const justCreated =
        !hasPasswordIdentity &&
        new Date(user.created_at).getTime() > Date.now() - 5 * 60 * 1000; // within last 5 min

      if (justCreated && !invitationToken) {
        // Brand-new user with no token — show password setup
        setStatus("password");
        setMessage("Set a password to complete your account setup.");
        return;
      }

      if (!invitationToken) {
        // Authenticated but no token — try lookup by email as fallback
        const { data: invByEmail } = await supabase
          .from("invitations")
          .select("token")
          .eq("email", user.email!.toLowerCase())
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!invByEmail?.token) {
          setStatus("error");
          setMessage(
            "No pending invitation found for your account. It may have already been used or expired."
          );
          return;
        }

        // Re-run with the found token
        window.history.replaceState(
          {},
          "",
          `/accept-invitation?token=${invByEmail.token}`
        );
        navigate(`/accept-invitation?token=${invByEmail.token}`, { replace: true });
        return;
      }

      // ── Step 4: call the accept_invitation RPC (atomic, SECURITY DEFINER) ──
      const { data: result, error: rpcError } = await supabase.rpc(
        "accept_invitation",
        { p_token: invitationToken }
      );

      if (rpcError) {
        console.error("[AcceptInvitation] RPC error:", rpcError);
        setStatus("error");
        setMessage("Failed to accept the invitation. Please try again or contact support.");
        return;
      }

      const rpcResult = result as Record<string, unknown>;

      if (rpcResult?.error) {
        const err = rpcResult.error as string;
        switch (err) {
          case "not_authenticated":
            navigate("/login", { replace: true });
            return;
          case "invitation_not_found":
            setStatus("error");
            setMessage(
              "This invitation has already been used or could not be found. Please ask to be re-invited."
            );
            return;
          case "invitation_expired":
            setStatus("error");
            setMessage("This invitation has expired. Please ask for a new invitation.");
            return;
          case "email_mismatch":
            setStatus("error");
            setMessage(
              "The invitation was sent to a different email address. Please sign in with the correct account."
            );
            return;
          default:
            setStatus("error");
            setMessage(`Invitation error: ${err}`);
            return;
        }
      }

      // ── Step 5: success — clear storage, invalidate cache, set onboarding_completed, navigate ──
      sessionStorage.removeItem("pending_invitation_token");

      // CRITICAL: invalidate useActiveOrg cache so the app sees the new membership immediately.
      await queryClient.invalidateQueries({ queryKey: ["activeOrg"] });
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.refetchQueries({ queryKey: ["activeOrg"] });

      // Invited team members inherit the org — skip create-organisation and staff onboarding
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        await supabase.auth.updateUser({
          data: { ...currentUser.user_metadata, onboarding_completed: true },
        });
        await supabase.auth.refreshSession();
      }

      const alreadyMember = rpcResult?.already_member as boolean | undefined;

      setStatus("success");
      setMessage(
        alreadyMember
          ? "You're already a member of this organisation!"
          : "You've successfully joined the organisation!"
      );
      toast.success("Welcome to the team!");

      // New team members arrive at the homehub dashboard
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 1500);
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Password setup (newly invited users with no password) ──────────────────
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!password || password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    setSettingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setPasswordError(error.message || "Failed to set password.");
        setSettingPassword(false);
        return;
      }
      toast.success("Password set!");
      setSettingPassword(false);
      setStatus("loading");
      // Reload to re-run the acceptance flow with the fresh session
      window.location.reload();
    } catch (err: any) {
      setPasswordError(err.message || "Failed to set password.");
      setSettingPassword(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  const title =
    status === "loading"
      ? "Accepting invitation…"
      : status === "success"
      ? "Invitation accepted!"
      : status === "password"
      ? "Set your password"
      : "Invitation error";

  const subtitle =
    status === "loading"
      ? "Please wait while we add you to the organisation."
      : message;

  return (
    <OnboardingContainer>
      <div className="animate-fade-in">
        <OnboardingHeader title={title} subtitle={subtitle} />

        <div className="mb-8 flex justify-center">
          <div
            className="p-6 rounded-3xl inline-block"
            style={{
              boxShadow:
                "inset 2px 2px 6px rgba(0,0,0,0.08), inset -2px -2px 6px rgba(255,255,255,0.7)",
            }}
          >
            {status === "loading" && (
              <Loader2 className="w-12 h-12 text-[#8EC9CE] animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            )}
            {(status === "error") && (
              <XCircle className="w-12 h-12 text-[#EB6834]" />
            )}
            {status === "password" && (
              <Lock className="w-12 h-12 text-[#8EC9CE]" />
            )}
          </div>
        </div>

        {status === "error" && (
          <div className="space-y-3">
            <NeomorphicButton variant="primary" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </NeomorphicButton>
            <NeomorphicButton variant="ghost" onClick={() => navigate("/login")}>
              Sign In
            </NeomorphicButton>
          </div>
        )}

        {status === "loading" && (
          <p className="text-sm text-[#6D7480] text-center">
            This may take a moment…
          </p>
        )}

        {status === "password" && (
          <div className="space-y-6">
            <form onSubmit={handleSetPassword} className="space-y-4">
              <NeomorphicPasswordInput
                label="Set Password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={passwordError}
                disabled={settingPassword}
              />
              <NeomorphicButton
                type="submit"
                variant="primary"
                disabled={settingPassword || password.length < 8}
              >
                {settingPassword
                  ? "Setting password…"
                  : "Set Password & Accept Invitation"}
              </NeomorphicButton>
            </form>
            <p className="text-sm text-[#6D7480] text-center">
              After setting your password you'll be added to the organisation automatically.
            </p>
          </div>
        )}
      </div>
    </OnboardingContainer>
  );
}
