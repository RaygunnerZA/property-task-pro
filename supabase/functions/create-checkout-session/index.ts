// create-checkout-session — Stripe Checkout for plan upgrades / seat add-ons
// Primary Owner only. @Docs/20_Billing.md §20.8 · Phase 3

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { corsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import {
  jsonResponse,
  resolvePriceIdForTier,
  seatAddonPriceId,
  storagePackPriceId,
  aiPackPriceId,
  messagingPackPriceId,
} from "../_shared/stripe.ts";

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

  let body: {
    org_id?: string;
    tier_id?: string;
    mode?: "subscription" | "seat_addon" | "storage_addon" | "ai_addon" | "messaging_addon";
    seat_quantity?: number;
    storage_pack_quantity?: number;
    ai_pack_quantity?: number;
    messaging_pack_quantity?: number;
    success_path?: string;
    cancel_path?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, corsHeaders);
  }

  const orgId = body.org_id;
  if (!orgId) {
    return jsonResponse({ error: "org_id is required" }, 400, corsHeaders);
  }

  const { data: membership, error: memError } = await supabaseAdmin
    .from("organisation_members")
    .select("role, is_primary_owner")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memError || !membership?.is_primary_owner) {
    return jsonResponse(
      { error: "Only the Primary Owner can manage billing" },
      403,
      corsHeaders
    );
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const { data: subRow } = await supabaseAdmin
    .from("org_subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, plan_id")
    .eq("org_id", orgId)
    .maybeSingle();

  let customerId = subRow?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { org_id: orgId, user_id: user.id },
    });
    customerId = customer.id;
    if (subRow) {
      await supabaseAdmin
        .from("org_subscriptions")
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", orgId);
    } else {
      await supabaseAdmin.from("org_subscriptions").insert({
        org_id: orgId,
        status: "incomplete",
        plan_id: "home",
        stripe_customer_id: customerId,
        billing_state: "active",
        seat_count: 0,
        updated_at: new Date().toISOString(),
      });
    }
  }

  const mode = body.mode ?? "subscription";
  const successPath = body.success_path ?? "/settings/billing?checkout=success";
  const cancelPath = body.cancel_path ?? "/settings/billing?checkout=cancel";
  const successUrl = `${APP_URL.replace(/\/$/, "")}${successPath.startsWith("/") ? "" : "/"}${successPath}`;
  const cancelUrl = `${APP_URL.replace(/\/$/, "")}${cancelPath.startsWith("/") ? "" : "/"}${cancelPath}`;

  let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  let metadata: Record<string, string> = { org_id: orgId, mode };

  if (mode === "seat_addon") {
    const priceId = seatAddonPriceId();
    if (!priceId) {
      return jsonResponse(
        { error: "Seat add-on price is not configured (STRIPE_PRICE_SEAT_ADDON)" },
        503,
        corsHeaders
      );
    }
    const qty = Math.max(1, Math.min(50, Number(body.seat_quantity ?? 1)));
    lineItems = [{ price: priceId, quantity: qty }];
    metadata = { ...metadata, seat_quantity: String(qty) };
  } else if (mode === "storage_addon") {
    const priceId = storagePackPriceId();
    if (!priceId) {
      return jsonResponse(
        { error: "Storage pack price is not configured (STRIPE_PRICE_STORAGE_PACK)" },
        503,
        corsHeaders
      );
    }
    const qty = Math.max(1, Math.min(20, Number(body.storage_pack_quantity ?? 1)));
    lineItems = [{ price: priceId, quantity: qty }];
    metadata = { ...metadata, storage_pack_quantity: String(qty) };
  } else if (mode === "ai_addon") {
    const priceId = aiPackPriceId();
    if (!priceId) {
      return jsonResponse(
        { error: "AI pack price is not configured (STRIPE_PRICE_AI_PACK)" },
        503,
        corsHeaders
      );
    }
    const qty = Math.max(1, Math.min(20, Number(body.ai_pack_quantity ?? 1)));
    lineItems = [{ price: priceId, quantity: qty }];
    metadata = { ...metadata, ai_pack_quantity: String(qty) };
  } else if (mode === "messaging_addon") {
    const priceId = messagingPackPriceId();
    if (!priceId) {
      return jsonResponse(
        { error: "Messaging pack price is not configured (STRIPE_PRICE_MESSAGING_PACK)" },
        503,
        corsHeaders
      );
    }
    const qty = Math.max(1, Math.min(20, Number(body.messaging_pack_quantity ?? 1)));
    lineItems = [{ price: priceId, quantity: qty }];
    metadata = { ...metadata, messaging_pack_quantity: String(qty) };
  } else {
    const tierId = body.tier_id;
    if (!tierId || tierId === "home") {
      return jsonResponse({ error: "tier_id is required for upgrades" }, 400, corsHeaders);
    }
    const priceId = resolvePriceIdForTier(tierId);
    if (!priceId) {
      return jsonResponse(
        {
          error: `Price not configured for tier "${tierId}". Set the matching STRIPE_PRICE_* secret.`,
        },
        503,
        corsHeaders
      );
    }
    lineItems = [{ price: priceId, quantity: 1 }];
    metadata = { ...metadata, tier_id: tierId };
  }

  // If already subscribed, prefer Customer Portal for plan changes (proration).
  if (subRow?.stripe_subscription_id && mode === "subscription") {
    return jsonResponse(
      {
        error: "existing_subscription",
        message:
          "You already have a subscription. Use Manage billing to change plans (proration applies).",
        use_portal: true,
      },
      409,
      corsHeaders
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: orgId,
      metadata,
      subscription_data: {
        metadata,
      },
      allow_promotion_codes: true,
    });

    return jsonResponse({ url: session.url, session_id: session.id }, 200, corsHeaders);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    console.error("[create-checkout-session]", message);
    return jsonResponse({ error: message }, 500, corsHeaders);
  }
});
