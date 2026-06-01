/**
 * dev-ensure-org-personas — Adds TEST-01…06 users to an org and marks onboarding complete.
 * Callable by an authenticated manager/owner (or dev_mode) in that org.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DEV_TEST_PERSONAS } from "../_shared/devTestPersonas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { org_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const orgId = body.org_id?.trim();
  if (!orgId) {
    return new Response(JSON.stringify({ error: "org_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user: caller },
    error: userErr,
  } = await supabaseUser.auth.getUser();

  if (userErr || !caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const devMode =
    caller.app_metadata?.dev_mode === true ||
    caller.app_metadata?.dev_mode === "true";

  const { data: callerMembership, error: callerMemberErr } = await supabaseUser
    .from("organisation_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", caller.id)
    .maybeSingle();

  if (callerMemberErr) {
    return new Response(JSON.stringify({ error: callerMemberErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const canManage =
    devMode ||
    (callerMembership?.role &&
      ["owner", "manager"].includes(callerMembership.role));

  if (!canManage) {
    return new Response(
      JSON.stringify({
        error: "Only a manager or owner of this org can link test users",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listData, error: listError } =
    await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

  if (listError) {
    return new Response(JSON.stringify({ error: listError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const usersByEmail = new Map(
    (listData?.users ?? []).map((u) => [u.email?.toLowerCase() ?? "", u])
  );

  let added = 0;
  let updated = 0;
  let onboardingPatched = 0;
  const missing: string[] = [];

  for (const persona of DEV_TEST_PERSONAS) {
    const authUser = usersByEmail.get(persona.email.toLowerCase());
    if (!authUser) {
      missing.push(persona.email);
      continue;
    }

    const { data: existing } = await supabaseAdmin
      .from("organisation_members")
      .select("id, role")
      .eq("org_id", orgId)
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (existing) {
      if (existing.role !== persona.role) {
        const { error: updateErr } = await supabaseAdmin
          .from("organisation_members")
          .update({ role: persona.role })
          .eq("id", existing.id);
        if (!updateErr) updated += 1;
      }
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from("organisation_members")
        .insert({
          org_id: orgId,
          user_id: authUser.id,
          role: persona.role,
          assigned_properties: [],
        });
      if (!insertErr) added += 1;
    }

    const { data: fullUser, error: getUserErr } =
      await supabaseAdmin.auth.admin.getUserById(authUser.id);

    if (getUserErr || !fullUser.user) continue;

    const meta =
      (fullUser.user.user_metadata as Record<string, unknown> | null) ?? {};
    if (meta.onboarding_completed !== true) {
      const { error: patchErr } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        {
          user_metadata: {
            ...meta,
            onboarding_completed: true,
          },
        }
      );
      if (!patchErr) onboardingPatched += 1;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      org_id: orgId,
      added,
      updated,
      onboardingPatched,
      missing,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
