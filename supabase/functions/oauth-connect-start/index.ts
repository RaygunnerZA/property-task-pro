// oauth-connect-start — returns OAuth authorization URL (Phase 2 shell)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Provider = "google" | "microsoft";

const PROVIDER_AUTH: Record<Provider, { authUrl: string; scopes: string[] }> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  },
  microsoft: {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    scopes: [
      "openid",
      "email",
      "offline_access",
      "Calendars.Read",
      "Files.Read",
    ],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as { provider?: Provider; org_id?: string; redirect_uri?: string };
    const provider = body.provider;
    const orgId = body.org_id;
    const redirectUri = body.redirect_uri;

    if (!provider || !orgId || !redirectUri) {
      return new Response(JSON.stringify({ error: "provider, org_id, redirect_uri required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!PROVIDER_AUTH[provider]) {
      return new Response(JSON.stringify({ error: "Unsupported provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId =
      provider === "google"
        ? Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")
        : Deno.env.get("MICROSOFT_OAUTH_CLIENT_ID");

    if (!clientId) {
      return new Response(
        JSON.stringify({
          error: "OAuth not configured",
          message: `Set ${provider === "google" ? "GOOGLE_OAUTH_CLIENT_ID" : "MICROSOFT_OAUTH_CLIENT_ID"} to enable connections.`,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const state = btoa(
      JSON.stringify({
        org_id: orgId,
        user_id: userData.user.id,
        provider,
      })
    );

    const cfg = PROVIDER_AUTH[provider];
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: cfg.scopes.join(" "),
      state,
      access_type: "offline",
      prompt: "consent",
    });

    const url = `${cfg.authUrl}?${params.toString()}`;

    return new Response(JSON.stringify({ url, scopes: cfg.scopes }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[oauth-connect-start]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
