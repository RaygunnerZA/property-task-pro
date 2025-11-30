import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicPasswordInput } from "@/components/onboarding/NeomorphicPasswordInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";
import { toast } from "sonner";

export default function SignUpScreen() {
  const navigate = useNavigate();
  const { email, password, setEmail, setPassword, setUserId } = useOnboardingStore();
  
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
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
      const redirectUrl = `${window.location.origin}/verify`;
      
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
          navigate("/onboarding/create-organisation");
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
    <OnboardingContainer>
      <div className="animate-fade-in">
        <ProgressDots current={0} total={6} />
        
        <OnboardingHeader
          title="Create your account"
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
            placeholder="At least 6 characters"
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
