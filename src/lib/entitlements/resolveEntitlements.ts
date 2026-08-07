import {
  HOME_ENTITLEMENTS,
  type OrgEntitlements,
} from "@/lib/entitlements/types";

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return fallback;
}

/**
 * Merge tier JSON (or any partial) onto Home defaults.
 * Supports legacy `max_properties` as alias for `active_properties_limit`.
 */
export function mergeEntitlements(raw: unknown): OrgEntitlements {
  const base = { ...HOME_ENTITLEMENTS };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return base;
  }
  const o = raw as Record<string, unknown>;

  const propertyLimit = o.active_properties_limit ?? o.max_properties;

  return {
    active_properties_limit: asNumber(propertyLimit, base.active_properties_limit),
    coordinating_seats_limit: asNumber(
      o.coordinating_seats_limit,
      base.coordinating_seats_limit
    ),
    staff_active_monthly_allowance: asNumber(
      o.staff_active_monthly_allowance,
      base.staff_active_monthly_allowance
    ),
    can_add_staff: asBoolean(o.can_add_staff, base.can_add_staff),
    multi_property_enabled: asBoolean(
      o.multi_property_enabled,
      base.multi_property_enabled
    ),
    external_submissions_enabled: asBoolean(
      o.external_submissions_enabled,
      base.external_submissions_enabled
    ),
    compliance_enabled: asBoolean(o.compliance_enabled, base.compliance_enabled),
    advanced_reports_enabled: asBoolean(
      o.advanced_reports_enabled,
      base.advanced_reports_enabled
    ),
    api_enabled: asBoolean(o.api_enabled, base.api_enabled),
    evidence_bytes_allowance: asNumber(
      o.evidence_bytes_allowance,
      base.evidence_bytes_allowance
    ),
    ai_ops_allowance: asNumber(o.ai_ops_allowance, base.ai_ops_allowance),
    premium_messaging_allowance: asNumber(
      o.premium_messaging_allowance,
      base.premium_messaging_allowance
    ),
    approval_workflows_enabled: asBoolean(
      o.approval_workflows_enabled,
      base.approval_workflows_enabled
    ),
    advanced_audit_export_enabled: asBoolean(
      o.advanced_audit_export_enabled,
      base.advanced_audit_export_enabled
    ),
    configurable_retention_enabled: asBoolean(
      o.configurable_retention_enabled,
      base.configurable_retention_enabled
    ),
    teams_regions_enabled: asBoolean(
      o.teams_regions_enabled,
      base.teams_regions_enabled
    ),
    sso_enabled: asBoolean(o.sso_enabled, base.sso_enabled),
  };
}

export function hasEntitlement(
  ents: OrgEntitlements,
  key: keyof OrgEntitlements
): boolean {
  const v = ents[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  return false;
}

export function getAllowance(
  ents: OrgEntitlements,
  key: keyof OrgEntitlements
): number {
  const v = ents[key];
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return 0;
}

export function resolvePlanLabel(
  tierName: string | null | undefined,
  hasSubscription: boolean
): string {
  if (tierName && tierName.trim()) return tierName;
  if (!hasSubscription) return "Home";
  return "Home";
}
