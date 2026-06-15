// calendar-import — list events from connected account and create intake_items (Phase 3 shell)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = (await req.json()) as {
      org_id?: string;
      provider?: "google" | "microsoft";
      time_min?: string;
      time_max?: string;
      import?: boolean;
    };

    if (!body.org_id || !body.provider) {
      return new Response(JSON.stringify({ error: "org_id and provider required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: account } = await client
      .from("connected_accounts")
      .select("id, status, access_token_enc")
      .eq("org_id", body.org_id)
      .eq("user_id", userData.user.id)
      .eq("provider", body.provider)
      .eq("status", "active")
      .maybeSingle();

    if (!account?.access_token_enc) {
      return new Response(
        JSON.stringify({
          error: "not_connected",
          message: "Connect your account in Settings → Integrations first.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Full Google/Microsoft API sync deferred until OAuth callback stores tokens.
    return new Response(
      JSON.stringify({
        events: [],
        message: "Calendar import API shell ready — connect OAuth and deploy token decryption to enable sync.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[calendar-import]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
