import { supabase } from "@/integrations/supabase/client";

/**
 * Idempotent sample content for first-time visitors (DB: seed_onboarding_demo_for_property).
 * Safe to call after property create or when opening an empty property.
 */
export async function ensureOnboardingDemoForProperty(
  propertyId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!propertyId) return { ok: false, error: "missing property id" };

  const { error } = await supabase.rpc("seed_onboarding_demo_for_property", {
    p_property_id: propertyId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
