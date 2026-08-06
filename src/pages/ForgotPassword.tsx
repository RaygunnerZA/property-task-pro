import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAppBaseUrl } from "@/lib/utils";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

/**
 * Request a password-reset email that lands on `/reset-password`
 * (not the Site URL / login page).
 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    const fromQuery = searchParams.get("email");
    if (fromQuery) setEmail(fromQuery);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);

    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Invalid email");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${getAppBaseUrl()}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        parsed.data.email.trim().toLowerCase(),
        { redirectTo }
      );

      if (resetError) {
        console.error("[ForgotPassword] resetPasswordForEmail:", resetError);
        toast.error(resetError.message || "Couldn't send reset email");
        return;
      }

      setSent(true);
      toast.success("Check your email for a reset link");
    } catch (err) {
      console.error("[ForgotPassword] unexpected:", err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingContainer>
      <div className="animate-fade-in">
        <OnboardingHeader
          title={sent ? "Check your email" : "Forgot password"}
          subtitle={
            sent
              ? `If an account exists for ${email.trim()}, we sent a link to set a new password.`
              : "Enter your email and we’ll send a link to reset your password."
          }
          showBack
          onBack={() => navigate("/login")}
        />

        {sent ? (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              The link opens the Set new password page. It may take a minute to arrive —
              check spam if you don’t see it.
            </p>
            <NeomorphicButton
              type="button"
              variant="primary"
              onClick={() => navigate("/login")}
            >
              Back to sign in
            </NeomorphicButton>
            <NeomorphicButton
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => {
                setSent(false);
              }}
            >
              Try a different email
            </NeomorphicButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <NeomorphicInput
              label="Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={error}
              autoComplete="email"
              autoFocus
            />

            <div className="pt-4 space-y-3">
              <NeomorphicButton type="submit" variant="primary" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </NeomorphicButton>
              <NeomorphicButton
                type="button"
                variant="ghost"
                onClick={() => navigate("/login")}
              >
                Back to sign in
              </NeomorphicButton>
            </div>
          </form>
        )}
      </div>
    </OnboardingContainer>
  );
}
