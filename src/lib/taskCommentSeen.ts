/** Per-user local “seen” timestamps for task comment signals on cards. */

const STORAGE_KEY = "filla:task-comment-seen";
export const TASK_COMMENT_SEEN_EVENT = "filla:task-comment-seen";

type SeenMap = Record<string, string>;

function readMap(): SeenMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as SeenMap;
  } catch {
    return {};
  }
}

function writeMap(map: SeenMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

export function getTaskCommentSeenAt(taskId: string): string | null {
  const at = readMap()[taskId];
  return typeof at === "string" && at ? at : null;
}

/** Mark comments on this task as seen (typically when Task Detail opens). */
export function markTaskCommentSeen(taskId: string, at: string = new Date().toISOString()) {
  if (!taskId) return;
  const map = readMap();
  map[taskId] = at;
  writeMap(map);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TASK_COMMENT_SEEN_EVENT, { detail: { taskId, at } }));
  }
}

/**
 * True when the latest comment is from someone else and newer than the last time
 * this user opened the task (or never opened).
 */
export function isTaskCommentSignalNew(args: {
  createdAt: string | null | undefined;
  authorUserId: string | null | undefined;
  currentUserId: string | null | undefined;
  taskId: string;
}): boolean {
  const { createdAt, authorUserId, currentUserId, taskId } = args;
  if (!createdAt) return false;
  if (authorUserId && currentUserId && authorUserId === currentUserId) return false;
  const seenAt = getTaskCommentSeenAt(taskId);
  if (!seenAt) return true;
  return new Date(createdAt).getTime() > new Date(seenAt).getTime();
}
