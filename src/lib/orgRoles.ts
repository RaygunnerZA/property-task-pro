/** Display copy for organisation roles — keep in sync with invite flow / backend.
 * Canonical internal roles: owner | manager | staff (@Docs/02_Identity.md).
 * Legacy `member` is not offered for new invites (normalizeOrgRole maps it → staff).
 */

export const INTERNAL_ORG_ROLES = [
  { value: "owner", label: "Owner", description: "Co-owner — full organisation control" },
  { value: "manager", label: "Manager", description: "Coordinate work on assigned or all properties" },
  { value: "staff", label: "Staff", description: "Execute assigned tasks and add evidence" },
] as const;

/**
 * External invite labels for vendor/contractor flows.
 * Durable External access is preferably link/token scoped (Phase 2+);
 * these remain available for invite UX until secure links ship.
 */
export const EXTERNAL_ORG_ROLES = [
  { value: "contractor", label: "Contractor", description: "Complete assigned tasks" },
  { value: "vendor", label: "Vendor", description: "Service provider access" },
  { value: "inspector", label: "Inspector", description: "Inspection & compliance access" },
] as const;
