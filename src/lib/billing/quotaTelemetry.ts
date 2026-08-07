/**
 * Billing / quota frustration telemetry — fire from data-layer gates only.
 * @Docs/24 §24.5 · @Docs/28 Phase 7
 */
import { track } from "@/lib/analytics";

export type QuotaMeter =
  | "evidence"
  | "ai_ops"
  | "messaging"
  | "properties"
  | "seats";

export function trackQuotaWarned(orgId: string, meter: QuotaMeter, ratio: number): void {
  track("quota_warned", {
    org_id: orgId,
    meter,
    ratio: Math.round(ratio * 1000) / 1000,
  });
}

export function trackQuotaBlocked(orgId: string, meter: QuotaMeter): void {
  track("quota_blocked", { org_id: orgId, meter });
}

export function trackAddonCheckoutStarted(
  orgId: string,
  mode: string
): void {
  track("addon_checkout_started", { org_id: orgId, mode });
}

export function trackUpgradeCtaClicked(
  orgId: string,
  moment: string
): void {
  track("upgrade_cta_clicked", { org_id: orgId, moment });
}
