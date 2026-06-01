import type { User } from "@supabase/supabase-js";
import type { OrgMember } from "@/hooks/useOrgMembers";

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

export type TaskAssigneeAvatarUser = {
  id: string;
  name?: string;
  imageUrl?: string;
  propertyColor?: string;
};

/** Resolve assignee name + profile photo from org members (tasks_view only stores user id). */
export function resolveTaskAssigneeUsers(
  task: {
    assigned_user_id?: string | null;
    assigned_user_name?: string | null;
    assignee_name?: string | null;
    assigned_user_image_url?: string | null;
    assignee_image_url?: string | null;
    assigned_user_avatar_url?: string | null;
    assignee_avatar_url?: string | null;
  } | null | undefined,
  members: OrgMember[],
  propertyColor = "#8EC9CE",
  currentUser?: User | null
): TaskAssigneeAvatarUser[] {
  const assignedUserId = task?.assigned_user_id;
  if (!assignedUserId) return [];

  const member = members.find((m) => m.user_id === assignedUserId);
  const isCurrentUser = currentUser?.id === assignedUserId;
  const name =
    task?.assigned_user_name ||
    task?.assignee_name ||
    member?.display_name ||
    member?.nickname ||
    (isCurrentUser ? userDisplayName(currentUser) : undefined);
  const imageUrl =
    task?.assigned_user_image_url ||
    task?.assignee_image_url ||
    task?.assigned_user_avatar_url ||
    task?.assignee_avatar_url ||
    member?.avatar_url ||
    (isCurrentUser ? userAvatarUrl(currentUser) : undefined);

  return [
    {
      id: assignedUserId,
      name,
      imageUrl: imageUrl ?? undefined,
      propertyColor,
    },
  ];
}
