import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicPasswordInput } from "@/components/onboarding/NeomorphicPasswordInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { toast } from "sonner";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const REMEMBERED_EMAIL_KEY = "filla_remembered_email";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load remembered email on mount
  useEffect(() => {
    const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      console.log('[Login] Loaded remembered email from localStorage:', rememberedEmail);
    }
  }, []);

  // Save email to localStorage as user types (debounced)
  useEffect(() => {
    if (email && email.includes('@')) {
      const timer = setTimeout(() => {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        console.log('[Login] Saved email to localStorage:', email);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [email]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Validate with Zod
    const result = authSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      console.log('[Login] Starting sign in...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Login] Sign in error:', error);
        toast.error(error.message);
        return;
      }

      if (data.session) {
        console.log('[Login] Sign in successful');
        toast.success("Welcome back!");
        
        // Save email to localStorage for next visit
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        
        // Refresh session to ensure auth state is updated
        await supabase.auth.refreshSession();
        
        // Let AppBootLoader handle all routing decisions
        // It will check for org, properties, spaces and route accordingly
        navigate("/", { replace: true });
      }
    } catch (error: any) {
      console.error('[Login] Unexpected error:', error);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingContainer>
      <div className="animate-fade-in">
        <OnboardingHeader
          title="Welcome back"
          subtitle="Sign in to your Filla workspace"
          showBack
          onBack={() => navigate("/welcome")}
        />

        <form onSubmit={handleSignIn} className="space-y-4">
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

          <div className="pt-4 space-y-3">
            <NeomorphicButton
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </NeomorphicButton>

            <NeomorphicButton
              type="button"
              variant="ghost"
              onClick={() => navigate("/signup")}
            >
              Don't have an account? Sign up
            </NeomorphicButton>
          </div>
        </form>
      </div>
    </OnboardingContainer>
  );
}
