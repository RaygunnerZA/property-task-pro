import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { exchangeOAuthCodeFromUrl } from "@/lib/auth/oauth";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { NeomorphicPasswordInput } from "@/components/onboarding/NeomorphicPasswordInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string().min(8, "Please confirm your password"),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don’t match",
    path: ["confirm"],
  });

/**
 * Destination for password-recovery emails (`redirectTo=/reset-password`).
 * Establishes the recovery session from the URL, then lets the user set a new password.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function establishRecoverySession() {
      setChecking(true);
      setLinkError(null);

      try {
        // PKCE / code flow (newer Supabase recovery links)
        try {
          await exchangeOAuthCodeFromUrl();
        } catch (err) {
          console.warn("[ResetPassword] code exchange:", err);
        }

        // Implicit hash tokens: #access_token=…&type=recovery
        const hash = window.location.hash;
        if (hash?.includes("access_token")) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token") || "";
          const type = params.get("type");
          if (accessToken && (type === "recovery" || !type)) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
            window.history.replaceState(null, "", window.location.pathname);
          }
        }

        // Legacy query token used by older callback helpers
        const search = new URLSearchParams(window.location.search);
        const accessToken = search.get("access_token");
        if (accessToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: search.get("refresh_token") || "",
          });
          if (error) throw error;
          window.history.replaceState(null, "", window.location.pathname);
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (cancelled) return;

        if (!data.session) {
          setLinkError(
            "This reset link is invalid or has expired. Request a new one from the sign-in page."
          );
          setReady(false);
          return;
        }

        setReady(true);
      } catch (err) {
        console.error("[ResetPassword] session error:", err);
        if (!cancelled) {
          setLinkError(
            err instanceof Error
              ? err.message
              : "Couldn’t open this reset link. Request a new one."
          );
          setReady(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void establishRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        setChecking(false);
        setLinkError(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = passwordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) {
        toast.error(error.message);
        return;
      }

      setDone(true);
      toast.success("Password updated");
      // End recovery session so the next visit is a normal sign-in.
      await supabase.auth.signOut();
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      console.error("[ResetPassword] update:", err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingContainer>
      <div className="animate-fade-in">
        <OnboardingHeader
          title={done ? "Password updated" : "Set a new password"}
          subtitle={
            done
              ? "You can sign in with your new password."
              : "Choose a new password for your Filla account."
          }
          showBack
          onBack={() => navigate("/login")}
        />

        {checking ? (
          <p className="text-sm text-muted-foreground">Opening your reset link…</p>
        ) : linkError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">{linkError}</p>
            <NeomorphicButton
              type="button"
              variant="primary"
              onClick={() => navigate("/forgot-password")}
            >
              Request a new link
            </NeomorphicButton>
            <NeomorphicButton type="button" variant="ghost" onClick={() => navigate("/login")}>
              Back to sign in
            </NeomorphicButton>
          </div>
        ) : done ? (
          <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
        ) : ready ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <NeomorphicPasswordInput
              label="New password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="new-password"
              autoFocus
            />
            <NeomorphicPasswordInput
              label="Confirm password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={errors.confirm}
              autoComplete="new-password"
            />
            <div className="pt-4 space-y-3">
              <NeomorphicButton type="submit" variant="primary" disabled={loading}>
                {loading ? "Updating…" : "Update password"}
              </NeomorphicButton>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Open the link from your email to set a new password.
            </p>
            <NeomorphicButton
              type="button"
              variant="primary"
              onClick={() => navigate("/forgot-password")}
            >
              Request a reset link
            </NeomorphicButton>
          </div>
        )}
      </div>
    </OnboardingContainer>
  );
}
