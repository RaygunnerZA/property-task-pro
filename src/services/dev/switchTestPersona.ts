import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureTestPersonasInOrg,
  EnsureTestPersonasError,
} from "@/services/dev/ensureTestPersonasInOrg";
import {
  findTestPersona,
  getTestPersonaPassword,
  TEST_PERSONA_ORG_STORAGE_KEY,
  TEST_PERSONA_STORAGE_KEY,
  type TestPersonaId,
} from "@/lib/dev/testPersonas";

export class SwitchTestPersonaError extends Error {
  constructor(message: string) {
    super(message);
    super.name = "SwitchTestPersonaError";
  }
}

export interface SwitchTestPersonaOptions {
  /** Active org to add test users to before sign-in (required for switch). */
  orgId?: string;
}

/**
 * Signs in as a configured test persona (real auth session), persists the choice,
 * and reloads so org membership + RLS match the selected user.
 */
export async function switchTestPersona(
  supabase: SupabaseClient,
  queryClient: QueryClient,
  personaId: TestPersonaId | null,
  options?: SwitchTestPersonaOptions
): Promise<void> {
  if (!import.meta.env.DEV && import.meta.env.VITE_APP_DEV_BUILD !== "true") {
    throw new SwitchTestPersonaError("Test personas are only available in dev builds");
  }

  if (personaId === null) {
    sessionStorage.removeItem(TEST_PERSONA_STORAGE_KEY);
    sessionStorage.removeItem(TEST_PERSONA_ORG_STORAGE_KEY);
    queryClient.clear();
    window.location.assign("/");
    return;
  }

  const orgId = options?.orgId?.trim();
  if (!orgId) {
    throw new SwitchTestPersonaError(
      "No active organisation. Open your workbench org first, then switch test user."
    );
  }

  try {
    const linkResult = await ensureTestPersonasInOrg(supabase, orgId);
    if (linkResult.missing.length > 0) {
      throw new SwitchTestPersonaError(
        `Missing test accounts: ${linkResult.missing.join(", ")}. Run: node scripts/create-test-users.js`
      );
    }
  } catch (err) {
    if (err instanceof EnsureTestPersonasError) {
      throw new SwitchTestPersonaError(err.message);
    }
    throw err;
  }

  const persona = findTestPersona(personaId);
  if (!persona) {
    throw new SwitchTestPersonaError(`Unknown test persona: ${personaId}`);
  }

  const password = getTestPersonaPassword();
  const { error } = await supabase.auth.signInWithPassword({
    email: persona.email,
    password,
  });

  if (error) {
    throw new SwitchTestPersonaError(
      `${persona.testId} sign-in failed: ${error.message}. Check VITE_DEV_TEST_PASSWORD matches the test account password.`
    );
  }

  sessionStorage.setItem(TEST_PERSONA_STORAGE_KEY, personaId);
  sessionStorage.setItem(TEST_PERSONA_ORG_STORAGE_KEY, orgId);
  if (persona.uiRoleOverride) {
    sessionStorage.setItem("filla_dev_ui_role_override", persona.uiRoleOverride);
  } else {
    sessionStorage.removeItem("filla_dev_ui_role_override");
  }

  queryClient.clear();
  window.location.assign("/issues");
}
