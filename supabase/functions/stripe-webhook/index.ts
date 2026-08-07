// stripe-webhook — idempotent Stripe subscription sync
// @Docs/20_Billing.md §20.6 · Phase 3

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import {
  graceEndsAtFromNow,
  resolveTierIdForPrice,
  seatAddonPriceId,
  storagePackPriceId,
  STORAGE_PACK_BYTES,
  aiPackPriceId,
  AI_PACK_OPS,
  messagingPackPriceId,
  MESSAGING_PACK_UNITS,
} from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function mapStripeStatusToBillingState(
  status: string,
  graceEndsAt: string | null
): string {
  const s = status.toLowerCase();
  if (s === "active" || s === "trialing") return "active";
  if (s === "canceled" || s === "unpaid") return "canceled";
  if (s === "past_due" || s === "incomplete" || s === "incomplete_expired") {
    if (graceEndsAt && new Date(graceEndsAt) > new Date()) return "grace";
    return "expansion_locked";
  }
  return "active";
}

async function alreadyProcessed(eventId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("billing_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  return !!data?.id;
}

async function markProcessed(
  eventId: string,
  type: string,
  orgId: string | null,
  payload: unknown
) {
  await supabaseAdmin.from("billing_events").upsert({
    id: eventId,
    type,
    org_id: orgId,
    payload: payload as Record<string, unknown>,
    processed_at: new Date().toISOString(),
  });
}

function orgIdFromMetadata(obj: {
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
}): string | null {
  return (
    obj.metadata?.org_id ??
    obj.client_reference_id ??
    null
  );
}

async function upsertFromSubscription(
  subscription: Stripe.Subscription,
  opts?: { paymentFailed?: boolean }
) {
  const orgId =
    orgIdFromMetadata(subscription) ??
    (await lookupOrgByCustomer(typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id));

  if (!orgId) {
    console.warn("[stripe-webhook] no org_id for subscription", subscription.id);
    return null;
  }

  const priceIds = (subscription.items?.data ?? [])
    .map((item) => (typeof item.price === "string" ? item.price : item.price?.id))
    .filter(Boolean) as string[];

  let planId: string | null = null;
  let seatAddon: number | null = null;
  let storageAddonBytes: number | null = null;
  let aiAddonOps: number | null = null;
  let messagingAddon: number | null = null;
  const addonPrice = seatAddonPriceId();
  const storagePrice = storagePackPriceId();
  const aiPrice = aiPackPriceId();
  const messagingPrice = messagingPackPriceId();

  for (const priceId of priceIds) {
    const item = subscription.items.data.find(
      (i) => (typeof i.price === "string" ? i.price : i.price?.id) === priceId
    );
    const qty = item?.quantity ?? 0;
    if (addonPrice && priceId === addonPrice) {
      seatAddon = (seatAddon ?? 0) + qty;
      continue;
    }
    if (storagePrice && priceId === storagePrice) {
      storageAddonBytes = (storageAddonBytes ?? 0) + qty * STORAGE_PACK_BYTES;
      continue;
    }
    if (aiPrice && priceId === aiPrice) {
      aiAddonOps = (aiAddonOps ?? 0) + qty * AI_PACK_OPS;
      continue;
    }
    if (messagingPrice && priceId === messagingPrice) {
      messagingAddon = (messagingAddon ?? 0) + qty * MESSAGING_PACK_UNITS;
      continue;
    }
    const tier = resolveTierIdForPrice(priceId);
    if (tier) planId = tier;
  }

  const { data: existing } = await supabaseAdmin
    .from("org_subscriptions")
    .select("grace_ends_at, plan_id, seat_count, storage_addon_bytes, ai_addon_ops, messaging_addon_units")
    .eq("org_id", orgId)
    .maybeSingle();

  let graceEndsAt = existing?.grace_ends_at ?? null;
  let lastFailed: string | null = null;

  if (opts?.paymentFailed || subscription.status === "past_due") {
    if (!graceEndsAt || new Date(graceEndsAt) <= new Date()) {
      graceEndsAt = graceEndsAtFromNow();
    }
    lastFailed = new Date().toISOString();
  }

  if (subscription.status === "active" || subscription.status === "trialing") {
    graceEndsAt = null;
  }

  const billingState = mapStripeStatusToBillingState(
    subscription.status,
    graceEndsAt
  );

  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  await supabaseAdmin.rpc("upsert_org_subscription_from_billing", {
    p_org_id: orgId,
    p_plan_id: planId ?? existing?.plan_id ?? "home",
    p_status: subscription.status,
    p_billing_state: billingState,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscription.id,
    p_seat_count: seatAddon,
    p_storage_addon_bytes: storageAddonBytes,
    p_ai_addon_ops: aiAddonOps,
    p_messaging_addon_units: messagingAddon,
    p_cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    p_current_period_start: periodStart,
    p_current_period_end: periodEnd,
    p_grace_ends_at: graceEndsAt,
    p_last_payment_failed_at: lastFailed,
  });

  return orgId;
}

async function lookupOrgByCustomer(customerId: string | undefined | null) {
  if (!customerId) return null;
  const { data } = await supabaseAdmin
    .from("org_subscriptions")
    .select("org_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.org_id ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe-webhook] missing Stripe secrets");
    return new Response("Stripe not configured", { status: 503 });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe-webhook] signature", message);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  if (await alreadyProcessed(event.id)) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let orgId: string | null = null;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        orgId = orgIdFromMetadata(session);
        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subId);
          if (orgId && !subscription.metadata?.org_id) {
            await stripe.subscriptions.update(subId, {
              metadata: { ...subscription.metadata, org_id: orgId },
            });
            subscription.metadata = {
              ...subscription.metadata,
              org_id: orgId,
            };
          }
          orgId = (await upsertFromSubscription(subscription)) ?? orgId;
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        orgId = await upsertFromSubscription(subscription);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.subscription;
        if (subRef) {
          const subId = typeof subRef === "string" ? subRef : subRef.id;
          const subscription = await stripe.subscriptions.retrieve(subId);
          orgId = await upsertFromSubscription(subscription, {
            paymentFailed: true,
          });
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.subscription;
        if (subRef) {
          const subId = typeof subRef === "string" ? subRef : subRef.id;
          const subscription = await stripe.subscriptions.retrieve(subId);
          orgId = await upsertFromSubscription(subscription);
        }
        break;
      }
      default:
        console.log("[stripe-webhook] ignored", event.type);
    }

    await markProcessed(event.id, event.type, orgId, {
      type: event.type,
      id: event.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "handler failed";
    console.error("[stripe-webhook] handler", message);
    return new Response(`Handler error: ${message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
