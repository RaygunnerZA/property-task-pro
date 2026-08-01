/**
 * Build a person title for team / assignee UI.
 * First name alone is enough; surname is optional.
 */
export function formatPersonDisplayName(parts: {
  first_name?: string | null;
  last_name?: string | null;
  nickname?: string | null;
  email?: string | null;
  fallback?: string;
}): string {
  const first = parts.first_name?.trim() || "";
  const last = parts.last_name?.trim() || "";
  const fromNames = [first, last].filter(Boolean).join(" ");
  if (fromNames) return fromNames;

  const nick = parts.nickname?.trim() || "";
  if (nick) return nick;

  const email = parts.email?.trim() || "";
  if (email) return email;

  return parts.fallback?.trim() || "Unknown user";
}
