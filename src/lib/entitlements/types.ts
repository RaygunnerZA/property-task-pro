/**
 * Entitlement keys — @Docs/20_Billing.md §20.3 / @Docs/28 Appendix A.
 * Feature code must check these keys, never plan display names.
 */
export type EntitlementKey =
  | "active_properties_limit"
  | "coordinating_seats_limit"
  | "staff_active_monthly_allowance"
  | "can_add_staff"
  | "multi_property_enabled"
  | "external_submissions_enabled"
  | "compliance_enabled"
  | "advanced_reports_enabled"
  | "api_enabled"
  | "evidence_bytes_allowance"
  | "ai_ops_allowance";

export type OrgEntitlements = {
  active_properties_limit: number;
  coordinating_seats_limit: number;
  staff_active_monthly_allowance: number;
  can_add_staff: boolean;
  multi_property_enabled: boolean;
  external_submissions_enabled: boolean;
  compliance_enabled: boolean;
  advanced_reports_enabled: boolean;
  api_enabled: boolean;
  evidence_bytes_allowance: number;
  ai_ops_allowance: number;
};

/** Home defaults when no org_subscriptions row exists. */
export const HOME_ENTITLEMENTS: OrgEntitlements = {
  active_properties_limit: 1,
  coordinating_seats_limit: 1,
  staff_active_monthly_allowance: 0,
  can_add_staff: false,
  multi_property_enabled: false,
  external_submissions_enabled: false,
  compliance_enabled: false,
  advanced_reports_enabled: false,
  api_enabled: false,
  evidence_bytes_allowance: 536_870_912, // 512 MiB observe default
  ai_ops_allowance: 25,
};

export type OrgUsageMetrics = {
  coordinating_count?: number;
  staff_headcount?: number;
  owner_count?: number;
  manager_count?: number;
  member_legacy_count?: number;
  archived_property_count?: number;
};
