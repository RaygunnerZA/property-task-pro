/**
 * Effective access — Phase 2.
 * @see @Docs/02_Identity.md §10–§11
 */
import {
  isCoordinatingRole,
  isStaffRole,
  normalizeOrgRole,
  type CanonicalOrgRole,
} from "@/lib/permissions/normalizeOrgRole";
import type { OrgEntitlements } from "@/lib/entitlements";
import { HOME_ENTITLEMENTS } from "@/lib/entitlements";

export type EffectiveAccessInput = {
  role: string | null | undefined;
  entitlements?: OrgEntitlements | null;
  /** null/empty = all properties (Owner, or unscoped Manager/Staff). */
  assignedPropertyIds?: string[] | null;
  isPrimaryOwner?: boolean;
  /** When false (post-grace billing lock), block expansion actions. */
  expansionAllowed?: boolean;
};

export type EffectiveAccess = {
  role: CanonicalOrgRole | null;
  isCoordinating: boolean;
  isStaff: boolean;
  isPrimaryOwner: boolean;
  canCreateTask: boolean;
  canAssignWork: boolean;
  canInviteStaff: boolean;
  canInviteManagers: boolean;
  canManageRoles: boolean;
  canManageProperties: boolean;
  canManageBilling: boolean;
  canTransferOwnership: boolean;
  canAddProperty: boolean;
  multiPropertyEnabled: boolean;
  expansionAllowed: boolean;
  /** null = all properties in org; array = scoped. */
  propertyScopeIds: string[] | null;
};

function scopedPropertyIds(
  role: CanonicalOrgRole | null,
  assigned: string[] | null | undefined
): string[] | null {
  if (role === "owner") return null;
  if (!assigned || assigned.length === 0) return null;
  return assigned;
}

export function resolveEffectiveAccess(input: EffectiveAccessInput): EffectiveAccess {
  const role = normalizeOrgRole(input.role);
  const entitlements = input.entitlements ?? HOME_ENTITLEMENTS;
  const isPrimaryOwner = !!input.isPrimaryOwner;
  const expansionAllowed = input.expansionAllowed !== false;
  const propertyScopeIds = scopedPropertyIds(role, input.assignedPropertyIds);

  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isStaff = role === "staff";

  return {
    role,
    isCoordinating: isCoordinatingRole(input.role),
    isStaff: isStaffRole(input.role),
    isPrimaryOwner,
    canCreateTask: isOwner || isManager,
    canAssignWork: isOwner || isManager,
    canInviteStaff:
      expansionAllowed && (isOwner || isManager) && entitlements.can_add_staff,
    canInviteManagers: expansionAllowed && isOwner,
    canManageRoles: isOwner,
    canManageProperties: isOwner,
    canManageBilling: isPrimaryOwner,
    canTransferOwnership: isPrimaryOwner,
    canAddProperty:
      expansionAllowed &&
      isOwner &&
      (entitlements.multi_property_enabled ||
        entitlements.active_properties_limit > 1),
    multiPropertyEnabled: entitlements.multi_property_enabled,
    expansionAllowed,
    propertyScopeIds,
  };
}

/** Filter a property list by effective access scope. */
export function filterPropertiesByScope<T extends { id: string }>(
  properties: T[],
  access: Pick<EffectiveAccess, "propertyScopeIds">
): T[] {
  const scope = access.propertyScopeIds;
  if (!scope) return properties;
  const allowed = new Set(scope);
  return properties.filter((p) => allowed.has(p.id));
}
