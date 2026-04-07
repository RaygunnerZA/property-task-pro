import type { User } from "@supabase/supabase-js";

export function userDisplayName(user: User | null): string {
  if (!user) return "Account";
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const full =
    (typeof meta?.full_name === "string" && meta.full_name) ||
    (typeof meta?.name === "string" && meta.name) ||
    "";
  if (full.trim()) return full.trim();
  return user.email?.split("@")[0] || "Account";
}

export function userInitials(user: User | null): string {
  if (!user?.email) return "?";
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const name =
    (typeof meta?.full_name === "string" && meta.full_name) ||
    (typeof meta?.name === "string" && meta.name) ||
    "";
  if (name.trim()) {
    const parts = name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? "";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase() || user.email.slice(0, 2).toUpperCase();
  }
  return user.email.slice(0, 2).toUpperCase();
}

export function userAvatarUrl(user: User | null): string | undefined {
  if (!user) return undefined;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const u = meta?.avatar_url;
  return typeof u === "string" && u.trim() ? u.trim() : undefined;
}
