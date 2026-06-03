import type { Provider } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAppBaseUrl } from "@/lib/utils";

export type SocialAuthProvider = "google" | "apple" | "facebook";

const PROVIDER_MAP: Record<SocialAuthProvider, Provider> = {
  google: "google",
  apple: "apple",
  facebook: "facebook",
};

/** OAuth return URL — must be allowlisted in Supabase Auth → URL Configuration. */
export function getOAuthRedirectUrl(): string {
  return `${getAppBaseUrl()}/auth/callback`;
}

/**
 * Starts Supabase OAuth (redirects the browser to the provider).
 * Enable Google, Apple, and Facebook under Supabase Dashboard → Authentication → Providers.
 */
export async function signInWithSocialProvider(provider: SocialAuthProvider) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: PROVIDER_MAP[provider],
    options: {
      redirectTo: getOAuthRedirectUrl(),
      ...(provider === "google"
        ? {
            queryParams: {
              prompt: "select_account",
            },
          }
        : {}),
      ...(provider === "apple"
        ? {
            scopes: "email name",
          }
        : {}),
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/** Exchange PKCE `code` query param after OAuth redirect (if session not auto-detected). */
export async function exchangeOAuthCodeFromUrl(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return false;

  const cleanUrl = `${window.location.pathname}${window.location.hash}`;

  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) {
    window.history.replaceState(null, "", cleanUrl);
    return true;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    throw error;
  }

  window.history.replaceState(null, "", cleanUrl);
  return true;
}
