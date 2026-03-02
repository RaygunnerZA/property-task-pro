import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { NewtonsCradle } from "ldrs/react";
import "ldrs/react/NewtonsCradle.css";

/** Minimum time to show loading screen so org/property checks can complete */
const MIN_LOADING_MS = 2500;

/**
 * AuthCallback - Transition page after login
 *
 * Shows a loading screen with NewtonsCradle while validating user has org, property, etc.
 * Waits at least MIN_LOADING_MS so checks have time to complete before routing.
 * Routes to:
 * - / if user has an org (and properties for owner/manager)
 * - /onboarding/create-organisation if user needs to onboard
 * - /onboarding/add-property if user has org but no properties
 * - /welcome if not authenticated
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "error">("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function runChecks(): Promise<string | null> {
      try {
        // 1. Check if user is authenticated
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e1a6'},body:JSON.stringify({sessionId:'96e1a6',runId:'invite-inherit-baseline',hypothesisId:'H2',location:'AuthCallback.tsx:runChecks:getUser',message:'auth callback user lookup',data:{hasUser:!!user,userId:user?.id,email:user?.email,userError:userError?.message},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        if (userError || !user) {
          return "/welcome";
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
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e1a6'},body:JSON.stringify({sessionId:'96e1a6',runId:'invite-inherit-baseline',hypothesisId:'H2',location:'AuthCallback.tsx:runChecks:membership',message:'membership query result in auth callback',data:{hasMembership:!!membership,orgId:membership?.org_id ?? null,role:membership?.role ?? null,membershipError:membershipError?.message ?? null,membershipCode:(membershipError as any)?.code ?? null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        if (cancelled) return null;

        if (membership?.org_id) {
          const isStaff = membership.role !== "owner" && membership.role !== "manager";

          if (isStaff) {
            const onboardingCompleted = user.user_metadata?.onboarding_completed;
            if (!onboardingCompleted) {
              await supabase.auth.updateUser({
                data: { ...user.user_metadata, onboarding_completed: true }
              });
            }
            return "/";
          }

          // Owner/manager - check if they have properties
          const { count } = await supabase
            .from("properties")
            .select("id", { count: "exact", head: true })
            .eq("org_id", membership.org_id);

          if (cancelled) return null;

          if ((count ?? 0) > 0) {
            const onboardingCompleted = user.user_metadata?.onboarding_completed;
            if (!onboardingCompleted) {
              await supabase.auth.updateUser({
                data: { ...user.user_metadata, onboarding_completed: true }
              });
            }
            return "/";
          }
          return "/onboarding/add-property";
        }

        // Safety net: if this user has a pending invite, resolve it during this
        // loading gate before deciding onboarding vs dashboard routing.
        const userEmail = user.email?.toLowerCase();
        if (userEmail) {
          const { data: pendingInvitation } = await supabase
            .from("invitations")
            .select("token")
            .eq("email", userEmail)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e1a6'},body:JSON.stringify({sessionId:'96e1a6',runId:'invite-inherit-baseline',hypothesisId:'H3',location:'AuthCallback.tsx:runChecks:pendingInvitation',message:'pending invitation lookup by email',data:{userId:user.id,userEmail,foundPendingToken:!!pendingInvitation?.token},timestamp:Date.now()})}).catch(()=>{});
          // #endregion

          if (pendingInvitation?.token) {
            // Security guard: always route through dedicated invitation acceptance
            // so password activation is enforced before app access.
            return `/accept-invitation?token=${pendingInvitation.token}`;
          }
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'96e1a6'},body:JSON.stringify({sessionId:'96e1a6',runId:'invite-inherit-baseline',hypothesisId:'H5',location:'AuthCallback.tsx:runChecks:fallbackCreateOrg',message:'routing fallback to create-organisation',data:{reason:'no-membership-no-pending-invite',userId:user.id,userEmail:user.email?.toLowerCase() ?? null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return "/onboarding/create-organisation";
      } catch (err: any) {
        console.error("[AuthCallback] Unexpected error:", err);
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(err.message || "Something went wrong");
        }
        return null;
      }
    }

    const minDelay = new Promise<void>(resolve => setTimeout(resolve, MIN_LOADING_MS));

    Promise.all([runChecks(), minDelay]).then(([targetPath]) => {
      if (!cancelled && targetPath) {
        navigate(targetPath, { replace: true });
      }
    });

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
        <NewtonsCradle size="78" speed="1.4" color="#8EC9CE" />
        <h1 className="text-2xl font-semibold text-foreground mb-2 mt-6">
          Welcome back!
        </h1>
        <p className="text-muted-foreground">
          Setting up your workspace...
        </p>
      </div>
    </OnboardingContainer>
  );
}
