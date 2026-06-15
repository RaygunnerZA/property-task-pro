import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isPropertyProfileId } from "@/lib/propertyProfiles";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";

/** Resolves property profile from onboarding store, hydrating from auth metadata when needed. */
export function useOnboardingPropertyProfile() {
  const { propertyProfile, setPropertyProfile } = useOnboardingStore();

  useEffect(() => {
    if (propertyProfile) return;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      const stored = user?.user_metadata?.property_profile;
      if (isPropertyProfileId(stored)) {
        setPropertyProfile(stored);
      }
    });
  }, [propertyProfile, setPropertyProfile]);

  return propertyProfile;
}
