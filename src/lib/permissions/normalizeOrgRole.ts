/**
 * Canonical org membership roles (see @Docs/02_Identity.md).
 * Legacy `member` normalizes to Staff.
 */
export type CanonicalOrgRole = "owner" | "manager" | "staff";

export function normalizeOrgRole(
  role: string | null | undefined
): CanonicalOrgRole | null {
  if (!role) return null;
  const r = role.trim().toLowerCase();
  if (r === "owner") return "owner";
  // Legacy/admin labels → Manager coordinating access
  if (r === "manager" || r === "admin") return "manager";
  if (r === "staff" || r === "member") return "staff";
  return null;
}

export function isCoordinatingRole(role: string | null | undefined): boolean {
  const n = normalizeOrgRole(role);
  return n === "owner" || n === "manager";
}

export function isStaffRole(role: string | null | undefined): boolean {
  return normalizeOrgRole(role) === "staff";
}
