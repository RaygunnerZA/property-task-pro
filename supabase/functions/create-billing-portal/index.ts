// create-billing-portal — Stripe Customer Portal for plan/payment management
// Primary Owner only. @Docs/20_Billing.md §20.6 recovery · Phase 3

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { corsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { jsonResponse } from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const APP_URL = Deno.env.get("APP_URL") ?? Deno.env.get("SITE_URL") ?? "http://localhost:5173";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsHeaders);
  }

  if (!STRIPE_SECRET_KEY) {
    return jsonResponse(
      { error: "Stripe is not configured (STRIPE_SECRET_KEY)" },
      503,
      corsHeaders
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  }

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  }

  let body: { org_id?: string; return_path?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, corsHeaders);
  }

  const orgId = body.org_id;
  if (!orgId) {
    return jsonResponse({ error: "org_id is required" }, 400, corsHeaders);
  }

  const { data: membership } = await supabaseAdmin
    .from("organisation_members")
    .select("is_primary_owner")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.is_primary_owner) {
    return jsonResponse(
      { error: "Only the Primary Owner can manage billing" },
      403,
      corsHeaders
    );
  }

  const { data: subRow } = await supabaseAdmin
    .from("org_subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!subRow?.stripe_customer_id) {
    return jsonResponse(
      { error: "No billing customer yet. Choose a plan to get started." },
      400,
      corsHeaders
    );
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const returnPath = body.return_path ?? "/settings/billing";
  const returnUrl = `${APP_URL.replace(/\/$/, "")}${returnPath.startsWith("/") ? "" : "/"}${returnPath}`;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subRow.stripe_customer_id,
      return_url: returnUrl,
    });
    return jsonResponse({ url: session.url }, 200, corsHeaders);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portal session failed";
    console.error("[create-billing-portal]", message);
    return jsonResponse({ error: message }, 500, corsHeaders);
  }
});
