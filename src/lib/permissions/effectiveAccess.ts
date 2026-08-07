/**
 * Effective access stub — Phase 1.
 * Full evaluation (entitlement ∩ role ∩ assignment ∩ state) lands in Phase 2.
 * @see @Docs/02_Identity.md §10
 */
import {
  isCoordinatingRole,
  isStaffRole,
  normalizeOrgRole,
  type CanonicalOrgRole,
} from "@/lib/permissions/normalizeOrgRole";
import type { OrgEntitlements } from "@/lib/entitlements";

export type EffectiveAccessInput = {
  role: string | null | undefined;
  entitlements: OrgEntitlements;
  /** Property ids the member may access; null/undefined = unresolved (Phase 2). */
  assignedPropertyIds?: string[] | null;
};

export type EffectiveAccess = {
  role: CanonicalOrgRole | null;
  isCoordinating: boolean;
  isStaff: boolean;
  canInviteStaff: boolean;
  canAddProperty: boolean;
  multiPropertyEnabled: boolean;
};

export function resolveEffectiveAccess(input: EffectiveAccessInput): EffectiveAccess {
  const role = normalizeOrgRole(input.role);
  const { entitlements } = input;

  return {
    role,
    isCoordinating: isCoordinatingRole(input.role),
    isStaff: isStaffRole(input.role),
    canInviteStaff: entitlements.can_add_staff,
    canAddProperty:
      entitlements.multi_property_enabled ||
      entitlements.active_properties_limit > 1,
    multiPropertyEnabled: entitlements.multi_property_enabled,
  };
}
