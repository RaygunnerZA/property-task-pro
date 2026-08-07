/**
 * Packaging numbers — client mirror of subscription_tiers.entitlements.
 * Source of truth for enforcement remains the DB + get_org_entitlements.
 * Tune allowances via migration UPDATE on subscription_tiers; keep this in sync
 * for display/docs and Phase 7 packaging reviews (@Docs/28 Phase 7).
 */

import type { PlanTierId } from "@/lib/billing/planCatalog";
import type { OrgEntitlements } from "@/lib/entitlements/types";
import { HOME_ENTITLEMENTS } from "@/lib/entitlements/types";

/** Soft-warn threshold for variable-cost meters (evidence / AI). */
export const QUOTA_WARN_RATIO = 0.85;

/**
 * Soft-warn vs enforce matrix (as shipped after Phases 4–5).
 * Staff monthly-active remains observe-only (headcount shown in Settings).
 */
export const METER_ENFORCEMENT = {
  active_properties: "enforce",
  coordinating_seats: "enforce",
  staff_monthly_active: "observe",
  evidence_bytes: "enforce_new_uploads",
  ai_ops: "enforce_ai_path",
  premium_messaging: "enforce_when_send_exists",
} as const;

export type PackagingEntitlements = OrgEntitlements;

export const PACKAGING_BY_TIER: Record<PlanTierId, PackagingEntitlements> = {
  home: { ...HOME_ENTITLEMENTS },
  home_plus: {
    ...HOME_ENTITLEMENTS,
    coordinating_seats_limit: 5,
    staff_active_monthly_allowance: 10,
    can_add_staff: true,
    external_submissions_enabled: true,
    evidence_bytes_allowance: 2_147_483_648,
    ai_ops_allowance: 100,
    premium_messaging_allowance: 25,
  },
  portfolio_2_5: {
    ...HOME_ENTITLEMENTS,
    active_properties_limit: 5,
    coordinating_seats_limit: 5,
    staff_active_monthly_allowance: 25,
    can_add_staff: true,
    multi_property_enabled: true,
    external_submissions_enabled: true,
    compliance_enabled: true,
    evidence_bytes_allowance: 10_737_418_240,
    ai_ops_allowance: 500,
    premium_messaging_allowance: 100,
  },
  portfolio_6_15: {
    ...HOME_ENTITLEMENTS,
    active_properties_limit: 15,
    coordinating_seats_limit: 10,
    staff_active_monthly_allowance: 50,
    can_add_staff: true,
    multi_property_enabled: true,
    external_submissions_enabled: true,
    compliance_enabled: true,
    advanced_reports_enabled: true,
    evidence_bytes_allowance: 32_212_254_720,
    ai_ops_allowance: 1500,
    premium_messaging_allowance: 250,
  },
  portfolio_16_40: {
    ...HOME_ENTITLEMENTS,
    active_properties_limit: 40,
    coordinating_seats_limit: 20,
    staff_active_monthly_allowance: 100,
    can_add_staff: true,
    multi_property_enabled: true,
    external_submissions_enabled: true,
    compliance_enabled: true,
    advanced_reports_enabled: true,
    evidence_bytes_allowance: 107_374_182_400,
    ai_ops_allowance: 4000,
    premium_messaging_allowance: 500,
  },
  business: {
    ...HOME_ENTITLEMENTS,
    active_properties_limit: 100,
    coordinating_seats_limit: 50,
    staff_active_monthly_allowance: 250,
    can_add_staff: true,
    multi_property_enabled: true,
    external_submissions_enabled: true,
    compliance_enabled: true,
    advanced_reports_enabled: true,
    api_enabled: true,
    evidence_bytes_allowance: 549_755_813_888,
    ai_ops_allowance: 20_000,
    premium_messaging_allowance: 2000,
    approval_workflows_enabled: true,
    advanced_audit_export_enabled: true,
    configurable_retention_enabled: true,
    teams_regions_enabled: true,
    sso_enabled: true,
  },
};

/** Add-on pack sizes (must match Stripe edge + client pack constants). */
export const ADDON_PACKS = {
  storage_bytes: 10 * 1024 * 1024 * 1024, // 10 GiB
  ai_ops: 100,
  messaging_units: 100,
  seats: 1,
} as const;
