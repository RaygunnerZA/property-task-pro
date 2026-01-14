import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite_token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Check if user is already authenticated (e.g., after email verification)
  // If so and they have an invitation, redirect to accept-invitation
  // Also check for invitation token in URL - if present, redirect to accept-invitation
  useEffect(() => {
    const checkAuthAndInvitation = async () => {
      // Check for access_token in URL hash (from inviteUserByEmail invitation link)
      let hashAccessToken = null;
      let hashRefreshToken = null;
      let hashType = null;
      if (window.location.hash) {
        try {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          hashAccessToken = hashParams.get("access_token");
          hashRefreshToken = hashParams.get("refresh_token");
          hashType = hashParams.get("type");
          
          if (hashAccessToken && hashType === "invite") {
            console.log("[Login] Found access_token in hash from invitation, setting session and redirecting");
            // Set session first, then redirect
            try {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: hashAccessToken,
                refresh_token: hashRefreshToken || "",
              });
              
              if (!sessionError && sessionData?.session) {
                console.log("[Login] Session established, redirecting to accept-invitation");
                // Clear hash and redirect
                window.history.replaceState({}, '', "/accept-invitation");
                navigate("/accept-invitation", { replace: true });
                return;
              }
            } catch (err) {
              console.error("[Login] Error setting session from hash:", err);
            }
          }
        } catch (err) {
          console.error("Error parsing hash:", err);
        }
      }
      
      // Check if user is authenticated first
      const { data: { user } } = await supabase.auth.getUser();
      
      // If there's an invite_token in URL query params AND user is authenticated, redirect to accept-invitation
      // This handles the case where inviteUserByEmail redirects to login
      // But only if we're not already on accept-invitation (prevent loop) and user is authenticated
      if (inviteToken && user && !window.location.pathname.includes("accept-invitation")) {
        console.log("[Login] Found invite_token and user is authenticated, redirecting to accept-invitation");
        navigate(`/accept-invitation?token=${inviteToken}`, { replace: true });
        return;
      }
      
      // If there's an invite_token but user is not authenticated, stay on login page
      // The user needs to sign in first, then AcceptInvitation will handle the redirect
      if (user?.email && user.email_confirmed_at) {
        // User is authenticated and verified - check if they have a pending invitation
        const { data: pendingInvitation } = await supabase
          .from("invitations")
          .select("id, token")
          .eq("email", user.email.toLowerCase())
          .eq("status", "pending")
          .maybeSingle();
        
        if (pendingInvitation) {
          console.log("User is authenticated and has pending invitation, redirecting to accept");
          navigate(`/accept-invitation?token=${pendingInvitation.token || inviteToken || ''}`);
          return;
        }
        
        // User is authenticated but no invitation - check if they have an org
        const { data: memberData } = await supabase
          .from("organisation_members")
          .select("org_id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (memberData?.org_id) {
          // User has an org, redirect to dashboard
          navigate("/work/tasks");
        }
      }
    };
    
    checkAuthAndInvitation();
  }, [navigate, inviteToken]);

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
        
        // Check if this is an "Invalid login credentials" error for an invited user
        // Invited users don't have passwords set - they need to set one first
        if ((error.message.includes("Invalid login credentials") || 
             error.message.includes("Invalid credentials") ||
             error.message.includes("Email not confirmed")) && inviteToken) {
          // User might be an invited user without a password - redirect to accept-invitation to set password
          toast.info("Please set a password to accept your invitation");
          navigate(`/accept-invitation?token=${inviteToken}`, { replace: true });
          setLoading(false);
          return;
        }
        
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
