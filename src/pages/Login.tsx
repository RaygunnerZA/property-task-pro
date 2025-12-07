import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicPasswordInput } from "@/components/onboarding/NeomorphicPasswordInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { toast } from "sonner";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
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
        console.log('[Login] Sign in successful, checking org membership...');
        
        // Check org_id from JWT claims first (faster than DB query)
        const orgIdFromJwt = data.session.user.app_metadata?.org_id;
        
        if (orgIdFromJwt) {
          console.log('[Login] Found org_id in JWT:', orgIdFromJwt);
          toast.success("Welcome back!");
          navigate("/", { replace: true });
        } else {
          // Fallback: check organisation_members table
          console.log('[Login] No org_id in JWT, checking DB...');
          const { data: memberData, error: memberError } = await supabase
            .from('organisation_members')
            .select('org_id')
            .eq('user_id', data.user.id)
            .maybeSingle();

          if (memberError) {
            console.error('[Login] Member query error:', memberError);
          }

          if (memberData?.org_id) {
            console.log('[Login] Found org in DB:', memberData.org_id);
            toast.success("Welcome back!");
            navigate("/", { replace: true });
          } else {
            console.log('[Login] No org found, redirecting to onboarding');
            toast.success("Welcome! Let's set up your account.");
            navigate("/onboarding/create-organisation", { replace: true });
          }
        }
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
            required
          />

          <NeomorphicPasswordInput
            label="Password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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
