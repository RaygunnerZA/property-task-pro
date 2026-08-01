import type { User } from "@supabase/supabase-js";
import type { OrgMember } from "@/hooks/useOrgMembers";

/** Distinct member accents — same palette as profile/invite avatar colors. */
export const MEMBER_AVATAR_COLORS = [
  "#8EC9CE",
  "#EB6834",
  "#6B8E9B",
  "#D4A373",
  "#A78BFA",
  "#F472B6",
  "#34D399",
  "#FBBF24",
] as const;

/** Stable accent per user id so team members stay visually distinct on cards. */
export function memberAccentColor(userId: string | null | undefined): string {
  if (!userId) return MEMBER_AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return MEMBER_AVATAR_COLORS[Math.abs(hash) % MEMBER_AVATAR_COLORS.length];
}

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

export function userAvatarColor(user: User | null): string | undefined {
  if (!user) return undefined;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const c = meta?.avatar_color;
  return typeof c === "string" && c.trim() ? c.trim() : undefined;
}

export type TaskPersonAvatar = {
  id: string;
  name?: string;
  imageUrl?: string;
  /** Fallback fill when no photo — unique per member. */
  accentColor: string;
};

type TaskPeopleFields = {
  assigned_user_id?: string | null;
  assigned_user_name?: string | null;
  assignee_name?: string | null;
  assigned_user_image_url?: string | null;
  assignee_image_url?: string | null;
  assigned_user_avatar_url?: string | null;
  assignee_avatar_url?: string | null;
  /** Existing tasks column — assigner / task owner when present on the row or view. */
  owner_user_id?: string | null;
  created_by?: string | null;
};

function resolveOrgPerson(
  userId: string,
  members: OrgMember[],
  currentUser?: User | null,
  taskName?: string | null,
  taskImageUrl?: string | null
): TaskPersonAvatar {
  const member = members.find((m) => m.user_id === userId);
  const isCurrentUser = currentUser?.id === userId;
  const name =
    taskName ||
    member?.display_name ||
    member?.nickname ||
    (isCurrentUser ? userDisplayName(currentUser) : undefined);
  const imageUrl =
    taskImageUrl ||
    member?.avatar_url ||
    (isCurrentUser ? userAvatarUrl(currentUser) : undefined);
  const accentColor =
    (isCurrentUser ? userAvatarColor(currentUser) : undefined) ||
    memberAccentColor(userId);

  return {
    id: userId,
    name,
    imageUrl: imageUrl ?? undefined,
    accentColor,
  };
}

/** Resolve assignee name + profile photo from org members (tasks_view only stores user id). */
export function resolveTaskAssigneeUsers(
  task: TaskPeopleFields | null | undefined,
  members: OrgMember[],
  _propertyColor = "#8EC9CE",
  currentUser?: User | null
): TaskPersonAvatar[] {
  const assignedUserId = task?.assigned_user_id;
  if (!assignedUserId) return [];

  const imageFromTask =
    task?.assigned_user_image_url ||
    task?.assignee_image_url ||
    task?.assigned_user_avatar_url ||
    task?.assignee_avatar_url ||
    null;

  return [
    resolveOrgPerson(
      assignedUserId,
      members,
      currentUser,
      task?.assigned_user_name || task?.assignee_name,
      imageFromTask
    ),
  ];
}

/**
 * Assigner / “From” person — uses existing `owner_user_id` (or legacy `created_by` if present).
 * Task Engine lists assignee only; owner_user_id is an existing tasks column used as assigner.
 */
export function resolveTaskAssignerUser(
  task: TaskPeopleFields | null | undefined,
  members: OrgMember[],
  currentUser?: User | null
): TaskPersonAvatar | null {
  const assignerId = task?.owner_user_id || task?.created_by || null;
  if (!assignerId) return null;
  // Same person as assignee — only show For.
  if (task?.assigned_user_id && assignerId === task.assigned_user_id) return null;
  return resolveOrgPerson(assignerId, members, currentUser);
}

/** @deprecated Prefer TaskPersonAvatar — kept for OverlappingAvatars shape compat. */
export type TaskAssigneeAvatarUser = {
  id: string;
  name?: string;
  imageUrl?: string;
  propertyColor?: string;
  accentColor?: string;
};
