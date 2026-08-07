/**
 * Billing state helpers — @Docs/20_Billing.md §20.6
 */

export type BillingState =
  | "active"
  | "past_due"
  | "grace"
  | "expansion_locked"
  | "canceled";

export type OrgBillingStatus = {
  state: BillingState;
  expansion_allowed: boolean;
  status: string;
  plan_id: string | null;
  grace_ends_at: string | null;
  seat_addon: number;
  storage_addon_bytes: number;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export const DEFAULT_BILLING_STATUS: OrgBillingStatus = {
  state: "active",
  expansion_allowed: true,
  status: "home",
  plan_id: null,
  grace_ends_at: null,
  seat_addon: 0,
  storage_addon_bytes: 0,
  cancel_at_period_end: false,
  current_period_end: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
};

export function parseBillingStatus(raw: unknown): OrgBillingStatus {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_BILLING_STATUS };
  }
  const o = raw as Record<string, unknown>;
  const state = (typeof o.state === "string" ? o.state : "active") as BillingState;
  return {
    state,
    expansion_allowed: o.expansion_allowed !== false,
    status: typeof o.status === "string" ? o.status : "home",
    plan_id: typeof o.plan_id === "string" ? o.plan_id : null,
    grace_ends_at: typeof o.grace_ends_at === "string" ? o.grace_ends_at : null,
    seat_addon: typeof o.seat_addon === "number" ? o.seat_addon : 0,
    storage_addon_bytes:
      typeof o.storage_addon_bytes === "number" ? o.storage_addon_bytes : 0,
    cancel_at_period_end: o.cancel_at_period_end === true,
    current_period_end:
      typeof o.current_period_end === "string" ? o.current_period_end : null,
    stripe_customer_id:
      typeof o.stripe_customer_id === "string" ? o.stripe_customer_id : null,
    stripe_subscription_id:
      typeof o.stripe_subscription_id === "string"
        ? o.stripe_subscription_id
        : null,
  };
}

export function isExpansionLocked(status: OrgBillingStatus): boolean {
  return !status.expansion_allowed;
}

export function isInGrace(status: OrgBillingStatus): boolean {
  return status.state === "grace";
}

export function needsPaymentRecovery(status: OrgBillingStatus): boolean {
  return (
    status.state === "grace" ||
    status.state === "expansion_locked" ||
    status.state === "past_due" ||
    status.state === "canceled"
  );
}
