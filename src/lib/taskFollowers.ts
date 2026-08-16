/**
 * Task followers are watchers, not the responsible assignee.
 * @Docs/05_Task_Engine.md §5.2 · @Docs/02_Identity.md §11
 */

export function personInitials(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const last = parts[parts.length - 1]?.[0] ?? "";
    return `${first}${last}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function parseFollowerUserIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export function membershipCanEditTaskDetails(opts: {
  role: string | null | undefined;
  userId: string | null | undefined;
  assignedUserId: string | null | undefined;
}): boolean {
  if (!opts.userId) return false;
  const role = (opts.role ?? "").toLowerCase();
  if (role === "owner" || role === "manager") return true;
  return opts.assignedUserId === opts.userId;
}
