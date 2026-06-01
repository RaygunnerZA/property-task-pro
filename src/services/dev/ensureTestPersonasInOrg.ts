import type { SupabaseClient } from "@supabase/supabase-js";

export interface EnsureTestPersonasResult {
  ok: boolean;
  org_id: string;
  added: number;
  updated: number;
  onboardingPatched: number;
  missing: string[];
}

export class EnsureTestPersonasError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnsureTestPersonasError";
  }
}

/**
 * Links TEST-01…06 to the given org (membership + onboarding_completed).
 * Must be called while signed in as a manager/owner of that org.
 */
export async function ensureTestPersonasInOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<EnsureTestPersonasResult> {
  if (!import.meta.env.DEV && import.meta.env.VITE_APP_DEV_BUILD !== "true") {
    throw new EnsureTestPersonasError("Only available in dev builds");
  }

  const { data, error } = await supabase.functions.invoke("dev-ensure-org-personas", {
    body: { org_id: orgId },
  });

  if (error) {
    throw new EnsureTestPersonasError(
      error.message ||
        "Could not link test users. Deploy the dev-ensure-org-personas edge function."
    );
  }

  const payload = data as EnsureTestPersonasResult & { error?: string };
  if (payload?.error) {
    throw new EnsureTestPersonasError(payload.error);
  }

  if (!payload?.ok) {
    throw new EnsureTestPersonasError("Unexpected response from dev-ensure-org-personas");
  }

  return {
    ok: true,
    org_id: payload.org_id,
    added: payload.added ?? 0,
    updated: payload.updated ?? 0,
    onboardingPatched: payload.onboardingPatched ?? 0,
    missing: payload.missing ?? [],
  };
}
