import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { Loader2 } from "lucide-react";

/**
 * AuthCallback - Transition page after login
 * 
 * Shows a welcome message + spinner while checking if the user has onboarded.
 * Routes to:
 * - /work/tasks if user has an org
 * - /onboarding/create-organisation if user needs to onboard
 * - /welcome if not authenticated
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "error">("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkUserStatus() {
      try {
        // 1. Check if user is authenticated
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          if (!cancelled) {
            navigate("/welcome", { replace: true });
          }
          return;
        }

        // 2. Check if user has an organisation membership
        const { data: membership, error: membershipError } = await supabase
          .from("organisation_members")
          .select("org_id, role")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          console.error("[AuthCallback] Error checking membership:", membershipError);
          // Don't block on error - let user proceed to onboarding
        }

        if (cancelled) return;

        if (membership?.org_id) {
          // User has an org - check if they have properties (for owner/manager)
          const isStaff = membership.role !== "owner" && membership.role !== "manager";
          
          if (isStaff) {
            // Staff members go straight to dashboard
            // Mark onboarding as complete if not already
            const onboardingCompleted = user.user_metadata?.onboarding_completed;
            if (!onboardingCompleted) {
              await supabase.auth.updateUser({
                data: { ...user.user_metadata, onboarding_completed: true }
              });
            }
            navigate("/work/tasks", { replace: true });
            return;
          }

          // Owner/manager - check if they have properties
          const { count } = await supabase
            .from("properties")
            .select("id", { count: "exact", head: true })
            .eq("org_id", membership.org_id);

          if (cancelled) return;

          if ((count ?? 0) > 0) {
            // Has properties - go to dashboard
            const onboardingCompleted = user.user_metadata?.onboarding_completed;
            if (!onboardingCompleted) {
              await supabase.auth.updateUser({
                data: { ...user.user_metadata, onboarding_completed: true }
              });
            }
            navigate("/work/tasks", { replace: true });
          } else {
            // Has org but no properties - continue onboarding
            navigate("/onboarding/add-property", { replace: true });
          }
        } else {
          // No org - needs to create one
          navigate("/onboarding/create-organisation", { replace: true });
        }
      } catch (err: any) {
        console.error("[AuthCallback] Unexpected error:", err);
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(err.message || "Something went wrong");
        }
      }
    }

    checkUserStatus();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (status === "error") {
    return (
      <OnboardingContainer>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <p className="text-lg text-destructive mb-4">
            {errorMessage || "Something went wrong"}
          </p>
          <button
            onClick={() => navigate("/welcome", { replace: true })}
            className="text-primary underline"
          >
            Return to login
          </button>
        </div>
      </OnboardingContainer>
    );
  }

  return (
    <OnboardingContainer>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Welcome back!
        </h1>
        <p className="text-muted-foreground">
          Setting up your workspace...
        </p>
      </div>
    </OnboardingContainer>
  );
}
