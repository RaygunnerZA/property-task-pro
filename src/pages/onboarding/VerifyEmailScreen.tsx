import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader, OnboardingLogoutButton } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";
import { getCurrentStep } from "@/utils/onboardingSteps";
import { getAppBaseUrl } from "@/lib/utils";
import { toast } from "sonner";
import { Mail, RefreshCw } from "lucide-react";

export default function VerifyEmailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { email } = useOnboardingStore();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  // When Supabase redirects here after email confirmation, tokens are in the hash. Set session and continue.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    try {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e1a6'},body:JSON.stringify({sessionId:'96e1a6',runId:'invite-inherit-baseline',hypothesisId:'H1',location:'VerifyEmailScreen.tsx:hashHandler',message:'verify screen hash handler parsed token payload',data:{type,hasAccessToken:!!accessToken,hasRefreshToken:!!refreshToken,path:window.location.pathname,search:window.location.search},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if ((type === "signup" || type === "magiclink") && accessToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken || "" })
          .then(({ error }) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e1a6'},body:JSON.stringify({sessionId:'96e1a6',runId:'invite-inherit-baseline',hypothesisId:'H1',location:'VerifyEmailScreen.tsx:hashHandler:setSessionResult',message:'verify screen setSession result',data:{hasError:!!error,error:error?.message ?? null},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            if (error) return;
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
            toast.success("Email verified!");
            navigate("/auth/callback", { replace: true });
          });
      }
    } catch {
      // Ignore parse errors
    }
  }, [navigate]);

  const checkVerification = async () => {
    setChecking(true);
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e1a6'},body:JSON.stringify({sessionId:'96e1a6',runId:'invite-inherit-baseline',hypothesisId:'H1',location:'VerifyEmailScreen.tsx:checkVerification',message:'manual verify check refresh session result',data:{hasSession:!!session,hasUser:!!session?.user,error:error?.message ?? null,userId:session?.user?.id ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      
      if (error) throw error;

      if (session?.user) {
        // User has a session - either verified or confirmation is disabled
        toast.success("Email verified!");
        navigate("/auth/callback", { replace: true });
      } else {
        toast.info("Please verify your email first", {
          description: "Check your inbox and spam folder"
        });
      }
    } catch (error: any) {
      toast.error("Unable to check verification status");
    } finally {
      setChecking(false);
    }
  };

  const resendEmail = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
        options: { emailRedirectTo: `${getAppBaseUrl()}/verify` },
      });

      if (error) throw error;
      
      toast.success("Verification email sent!");
    } catch (error: any) {
      toast.error("Failed to resend email");
    } finally {
      setResending(false);
    }
  };

  return (
    <OnboardingContainer topRight={<OnboardingLogoutButton />}>
      <div className="animate-fade-in">
        <ProgressDots current={getCurrentStep(location.pathname)} />
        
        <OnboardingHeader
          title="Check your email"
          showLogout={false}
          subtitle={`We sent a verification link to ${email}`}
          showBack
        />

        <div className="mb-8 flex justify-center">
          <div 
            className="p-6 rounded-3xl inline-block"
            style={{
              boxShadow: "inset 2px 2px 6px rgba(0,0,0,0.08), inset -2px -2px 6px rgba(255,255,255,0.7)"
            }}
          >
            <Mail className="w-12 h-12 text-[#FF6B6B]" />
          </div>
        </div>

        <div className="space-y-4">
          <NeomorphicButton
            variant="primary"
            onClick={checkVerification}
            disabled={checking}
          >
            {checking ? "Checking..." : "I've verified my email"}
          </NeomorphicButton>

          <NeomorphicButton
            variant="secondary"
            onClick={resendEmail}
            disabled={resending}
          >
            <RefreshCw className={`w-4 h-4 inline mr-2 ${resending ? 'animate-spin' : ''}`} />
            Resend verification email
          </NeomorphicButton>

          <NeomorphicButton
            variant="ghost"
            onClick={() => navigate("/login")}
          >
            Already have a verified account? Log in
          </NeomorphicButton>
        </div>

        <p className="text-sm text-[#6D7480] text-center mt-6">
          Can't find the email? Check your spam folder.<br />
          <strong>For testing:</strong> Disable email confirmation in Supabase → Authentication → Providers → Email
        </p>
      </div>
    </OnboardingContainer>
  );
}
