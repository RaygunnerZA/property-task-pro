/** Display copy for organisation roles — keep in sync with invite flow / backend. */

export const INTERNAL_ORG_ROLES = [
  { value: "owner", label: "Owner", description: "Co-owner — full organisation control" },
  { value: "manager", label: "Manager", description: "Manage properties, tasks & team" },
  { value: "staff", label: "Staff", description: "Execute tasks, view assigned properties" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
] as const;

export const EXTERNAL_ORG_ROLES = [
  { value: "contractor", label: "Contractor", description: "Complete assigned tasks" },
  { value: "vendor", label: "Vendor", description: "Service provider access" },
  { value: "inspector", label: "Inspector", description: "Inspection & compliance access" },
] as const;
