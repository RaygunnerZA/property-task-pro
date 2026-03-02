import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader, OnboardingLogoutButton } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicPasswordInput } from "@/components/onboarding/NeomorphicPasswordInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";
import { getCurrentStep } from "@/utils/onboardingSteps";
import { getAppBaseUrl } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";

const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function SignUpScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email, password, setEmail, setPassword, setUserId } = useOnboardingStore();
  
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate with Zod
    const result = signUpSchema.safeParse({ email, password });
    if (!result.success) {
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Use canonical app URL in production so confirmation email redirects to Vercel, not localhost.
      const redirectUrl = `${getAppBaseUrl()}/verify`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        if (error.message.includes("already registered") || error.message.includes("User already registered")) {
          toast.error("This email is already registered.", {
            description: "Try logging in instead or use a different email.",
            action: {
              label: "Go to Login",
              onClick: () => navigate("/login")
            }
          });
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        setUserId(data.user.id);
        
        // Check if email confirmation is disabled or user is already confirmed
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData.session || data.user.email_confirmed_at) {
          // Email confirmation is disabled or already confirmed - skip verification
          toast.success("Account created!");
          navigate("/auth/callback", { replace: true });
        } else if (data.user.identities && data.user.identities.length === 0) {
          // User exists but unconfirmed - this is a repeated signup
          toast.info("Account already exists but unconfirmed.", {
            description: "Check your email for the verification link, or try logging in."
          });
          navigate("/verify");
        } else {
          // Normal signup - email sent
          toast.success("Account created! Check your email to verify.");
          navigate("/verify");
        }
      }
    } catch (error: any) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingContainer topRight={<OnboardingLogoutButton />}>
      <div className="animate-fade-in">
        <ProgressDots current={getCurrentStep(location.pathname)} />
        
        <OnboardingHeader
          title="Create your account"
          showLogout={false}
          subtitle="Start your journey with Filla"
          showBack
          onBack={() => navigate("/welcome")}
        />

        <form onSubmit={(e) => { e.preventDefault(); handleSignUp(); }} className="space-y-4">
          <NeomorphicInput
            label="Email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />

          <NeomorphicPasswordInput
            label="Password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />

          <NeomorphicPasswordInput
            label="Confirm Password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
          />

          <div className="pt-4">
            <NeomorphicButton
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create Account"}
            </NeomorphicButton>
          </div>
        </form>
      </div>
    </OnboardingContainer>
  );
}
