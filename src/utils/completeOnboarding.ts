import type { NavigateFunction } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export async function markOnboardingComplete(): Promise<void> {
  localStorage.setItem("filla_onboarding_complete", "true");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.auth.updateUser({
    data: { ...user.user_metadata, onboarding_completed: true },
  });
  await supabase.auth.refreshSession();
}

/** Mark onboarding done and enter the workbench (demo task onboarding on home). */
export async function finishOwnerOnboarding(navigate: NavigateFunction): Promise<void> {
  await markOnboardingComplete();
  (window as unknown as { __lastOnboardingNavigation?: number }).__lastOnboardingNavigation =
    Date.now();
  navigate("/", { replace: true });
}
