/**
 * Stripe helpers for billing edge functions.
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *      STRIPE_PRICE_HOME_PLUS, STRIPE_PRICE_PORTFOLIO_2_5,
 *      STRIPE_PRICE_PORTFOLIO_6_15, STRIPE_PRICE_PORTFOLIO_16_40,
 *      STRIPE_PRICE_BUSINESS, STRIPE_PRICE_SEAT_ADDON,
 *      STRIPE_PRICE_STORAGE_PACK (optional, 10 GiB units),
 *      STRIPE_PRICE_AI_PACK (optional, 100 AI ops units),
 *      STRIPE_PRICE_MESSAGING_PACK (optional, 100 messaging units)
 */

export const TIER_PRICE_ENV: Record<string, string> = {
  home_plus: "STRIPE_PRICE_HOME_PLUS",
  portfolio_2_5: "STRIPE_PRICE_PORTFOLIO_2_5",
  portfolio_6_15: "STRIPE_PRICE_PORTFOLIO_6_15",
  portfolio_16_40: "STRIPE_PRICE_PORTFOLIO_16_40",
  business: "STRIPE_PRICE_BUSINESS",
};

export const PRICE_TO_TIER: Record<string, string> = {};

export function buildPriceTierMaps(): {
  tierToPrice: Record<string, string>;
  priceToTier: Record<string, string>;
} {
  const tierToPrice: Record<string, string> = {};
  const priceToTier: Record<string, string> = {};
  for (const [tierId, envKey] of Object.entries(TIER_PRICE_ENV)) {
    const priceId = Deno.env.get(envKey);
    if (priceId) {
      tierToPrice[tierId] = priceId;
      priceToTier[priceId] = tierId;
    }
  }
  return { tierToPrice, priceToTier };
}

export function resolvePriceIdForTier(tierId: string): string | null {
  const { tierToPrice } = buildPriceTierMaps();
  return tierToPrice[tierId] ?? null;
}

export function resolveTierIdForPrice(priceId: string): string | null {
  const { priceToTier } = buildPriceTierMaps();
  return priceToTier[priceId] ?? null;
}

export function seatAddonPriceId(): string | null {
  return Deno.env.get("STRIPE_PRICE_SEAT_ADDON") ?? null;
}

export function storagePackPriceId(): string | null {
  return Deno.env.get("STRIPE_PRICE_STORAGE_PACK") ?? null;
}

/** Bytes granted per storage pack quantity unit. */
export const STORAGE_PACK_BYTES = 10 * 1024 * 1024 * 1024;

export function aiPackPriceId(): string | null {
  return Deno.env.get("STRIPE_PRICE_AI_PACK") ?? null;
}

/** AI ops granted per pack quantity unit. */
export const AI_PACK_OPS = 100;

export function messagingPackPriceId(): string | null {
  return Deno.env.get("STRIPE_PRICE_MESSAGING_PACK") ?? null;
}

/** Premium messaging units per pack quantity. */
export const MESSAGING_PACK_UNITS = 100;

/** Default grace after payment failure (days). */
export const GRACE_PERIOD_DAYS = 14;

export function graceEndsAtFromNow(days = GRACE_PERIOD_DAYS): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function jsonResponse(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}
