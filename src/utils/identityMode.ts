import { Session } from "@supabase/supabase-js";

/**
 * Identity mode types supported by the system.
 */
export type IdentityMode = "personal" | "manager" | "staff" | "contractor";

/**
 * Source of the identity mode resolution.
 */
export type IdentityModeSource = "jwt" | "org_membership";

/**
 * Result of identity mode resolution.
 */
export interface IdentityModeResolution {
  mode: IdentityMode | null;
  source: IdentityModeSource | null;
}

/**
 * Organization type from the database.
 */
type OrgType = "personal" | "business" | "contractor";

/**
 * Organization member role from the database.
 */
type OrgRole = "owner" | "manager" | "member" | "staff";

/**
 * Resolves identity mode from JWT claims.
 * 
 * Checks app_metadata and user_metadata for identity_type claim.
 * 
 * @param session - Supabase session containing JWT claims
 * @returns Identity mode if found in JWT, null otherwise
 */
function resolveFromJWT(session: Session | null): IdentityMode | null {
  if (!session?.user) {
    return null;
  }

  const identityType =
    session.user.app_metadata?.identity_type ||
    session.user.user_metadata?.identity_type;

  // Validate that the identity_type from JWT is a valid mode
  const validModes: IdentityMode[] = ["personal", "manager", "staff", "contractor"];
  if (identityType && validModes.includes(identityType as IdentityMode)) {
    return identityType as IdentityMode;
  }

  return null;
}

/**
 * Resolves identity mode from organization membership.
 * 
 * Derives identity mode based on:
 * - org_type: 'personal' → 'personal', 'contractor' → 'contractor'
 * - role: 'staff' → 'staff', 'owner'/'manager' → 'manager'
 * 
 * @param orgType - Organization type (personal, business, contractor)
 * @param role - User's role in the organization (owner, manager, member, staff)
 * @returns Identity mode if resolvable, null otherwise
 */
function resolveFromOrgMembership(
  orgType: OrgType | null,
  role: OrgRole | null
): IdentityMode | null {
  // If org_type is 'personal', identity is 'personal'
  if (orgType === "personal") {
    return "personal";
  }

  // If org_type is 'contractor', identity is 'contractor'
  if (orgType === "contractor") {
    return "contractor";
  }

  // If no role, cannot resolve
  if (!role) {
    return null;
  }

  // If role is 'staff', identity is 'staff'
  if (role === "staff") {
    return "staff";
  }

  // If role is 'owner' or 'manager', identity is 'manager'
  if (role === "owner" || role === "manager") {
    return "manager";
  }

  // For 'member' role in business org, default to 'manager'
  // (member role typically has manager-level access)
  if (role === "member" && orgType === "business") {
    return "manager";
  }

  return null;
}

/**
 * Resolves identity mode from JWT claims and organization membership.
 * 
 * Resolution priority:
 * 1. JWT claims (identity_type in app_metadata or user_metadata)
 * 2. Organization membership (org_type and role)
 * 
 * @param session - Supabase session containing JWT claims
 * @param orgType - Organization type (optional, for fallback resolution)
 * @param role - User's role in the organization (optional, for fallback resolution)
 * @returns Identity mode resolution with mode and source
 */
export function resolveIdentityMode(
  session: Session | null,
  orgType: OrgType | null = null,
  role: OrgRole | null = null
): IdentityModeResolution {
  // First, try to resolve from JWT claims
  const jwtMode = resolveFromJWT(session);
  if (jwtMode) {
    return {
      mode: jwtMode,
      source: "jwt",
    };
  }

  // Fallback to organization membership
  const orgMode = resolveFromOrgMembership(orgType, role);
  if (orgMode) {
    return {
      mode: orgMode,
      source: "org_membership",
    };
  }

  // No resolution possible
  return {
    mode: null,
    source: null,
  };
}
