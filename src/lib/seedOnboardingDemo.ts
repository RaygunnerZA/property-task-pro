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

/** Replace legacy demo rows with education v2 content (existing properties). */
export async function refreshOnboardingEducationForProperty(
  propertyId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!propertyId) return { ok: false, error: "missing property id" };

  const { error } = await supabase.rpc("refresh_onboarding_education_for_property", {
    p_property_id: propertyId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function seedStaffTrainingTasks(
  orgId: string,
  userId: string,
  propertyId?: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc("seed_staff_training_tasks", {
    p_org_id: orgId,
    p_user_id: userId,
    p_property_id: propertyId ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
