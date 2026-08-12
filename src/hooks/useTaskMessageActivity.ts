import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "./useActiveOrg";
import { useOrgMembers } from "./useOrgMembers";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import { memberAccentColor } from "@/lib/userDisplayHelpers";
import {
  isTaskCommentSignalNew,
  TASK_COMMENT_SEEN_EVENT,
} from "@/lib/taskCommentSeen";

export type TaskMessagePreview = {
  taskId: string;
  messageId: string;
  body: string;
  createdAt: string;
  authorUserId: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  accentColor: string;
  /** Latest comment is from someone else and newer than last seen. */
  isUnread: boolean;
  /** Latest comment is from the current user (card stays dimmed after reply). */
  isOwnLatest: boolean;
};

export type PersonMessageThread = {
  authorKey: string;
  authorUserId: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  accentColor: string;
  latestBody: string;
  latestCreatedAt: string;
  /** Latest message per task for this author (most recent first). */
  taskPreviews: TaskMessagePreview[];
};

type RawMessageRow = {
  id: string;
  body: string | null;
  created_at: string;
  author_user_id: string | null;
  author_name: string | null;
  conversations:
    | { task_id?: string | null }
    | { task_id?: string | null }[]
    | null;
};

type RawActivityRow = {
  taskId: string;
  messageId: string;
  body: string;
  createdAt: string;
  authorUserId: string | null;
  authorNameHint: string | null;
};

async function fetchRecentTaskMessages(orgId: string): Promise<RawActivityRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, body, created_at, author_user_id, author_name, conversation_id, conversations!inner(task_id)"
    )
    .eq("org_id", orgId)
    .not("conversations.task_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1200);

  if (error) throw error;

  const rows: RawActivityRow[] = [];
  // Latest message per (author, task) for expandable person threads
  const seenAuthorTask = new Set<string>();

  for (const row of (data ?? []) as RawMessageRow[]) {
    const rawConv = row.conversations;
    const conv = Array.isArray(rawConv) ? rawConv[0] : rawConv;
    const taskId = conv?.task_id;
    if (!taskId || !row.created_at) continue;
    const authorKey = row.author_user_id ?? `name:${row.author_name ?? "unknown"}`;
    const pairKey = `${authorKey}::${taskId}`;
    if (seenAuthorTask.has(pairKey)) continue;
    seenAuthorTask.add(pairKey);
    rows.push({
      taskId: String(taskId),
      messageId: String(row.id),
      body: (row.body ?? "").trim() || "Attachment",
      createdAt: row.created_at,
      authorUserId: row.author_user_id ?? null,
      authorNameHint: row.author_name,
    });
  }

  return rows;
}

function useTaskCommentSeenTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onSeen = () => setTick((n) => n + 1);
    window.addEventListener(TASK_COMMENT_SEEN_EVENT, onSeen);
    return () => window.removeEventListener(TASK_COMMENT_SEEN_EVENT, onSeen);
  }, []);
  return tick;
}

export function useTaskMessageActivity() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { userId } = useDataContext();
  const { members } = useOrgMembers();
  const seenTick = useTaskCommentSeenTick();

  const query = useQuery({
    queryKey: ["task-message-activity", orgId],
    queryFn: () => fetchRecentTaskMessages(orgId!),
    enabled: !!orgId && !orgLoading,
    staleTime: 45_000,
  });

  const memberById = useMemo(() => {
    const map = new Map<string, { display_name: string; avatar_url: string | null }>();
    for (const m of members) {
      map.set(m.user_id, {
        display_name: m.display_name,
        avatar_url: m.avatar_url,
      });
    }
    return map;
  }, [members]);

  const resolveAuthor = (authorUserId: string | null, authorNameHint: string | null) => {
    const member = authorUserId ? memberById.get(authorUserId) : undefined;
    const authorName =
      member?.display_name ||
      authorNameHint?.trim() ||
      (authorUserId ? "Teammate" : "Someone");
    return {
      authorName,
      authorAvatarUrl: member?.avatar_url ?? null,
      accentColor: memberAccentColor(authorUserId),
    };
  };

  const latestByTask = useMemo(() => {
    void seenTick;
    const map: Record<string, TaskMessagePreview> = {};
    for (const row of query.data ?? []) {
      if (map[row.taskId]) continue;
      const author = resolveAuthor(row.authorUserId, row.authorNameHint);
      const isOwnLatest = Boolean(
        row.authorUserId && userId && row.authorUserId === userId
      );
      map[row.taskId] = {
        taskId: row.taskId,
        messageId: row.messageId,
        body: row.body,
        createdAt: row.createdAt,
        authorUserId: row.authorUserId,
        ...author,
        isUnread: isTaskCommentSignalNew({
          taskId: row.taskId,
          createdAt: row.createdAt,
          authorUserId: row.authorUserId,
          currentUserId: userId,
        }),
        isOwnLatest,
      };
    }
    return map;
    // resolveAuthor closes over memberById
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, memberById, userId, seenTick]);

  const personThreads = useMemo((): PersonMessageThread[] => {
    void seenTick;
    const byAuthor = new Map<string, PersonMessageThread>();

    for (const row of query.data ?? []) {
      const authorKey = row.authorUserId ?? `name:${row.authorNameHint ?? "unknown"}`;
      const author = resolveAuthor(row.authorUserId, row.authorNameHint);
      const preview: TaskMessagePreview = {
        taskId: row.taskId,
        messageId: row.messageId,
        body: row.body,
        createdAt: row.createdAt,
        authorUserId: row.authorUserId,
        ...author,
        isUnread: isTaskCommentSignalNew({
          taskId: row.taskId,
          createdAt: row.createdAt,
          authorUserId: row.authorUserId,
          currentUserId: userId,
        }),
        isOwnLatest: Boolean(
          row.authorUserId && userId && row.authorUserId === userId
        ),
      };

      const existing = byAuthor.get(authorKey);
      if (!existing) {
        byAuthor.set(authorKey, {
          authorKey,
          authorUserId: row.authorUserId,
          ...author,
          latestBody: row.body,
          latestCreatedAt: row.createdAt,
          taskPreviews: [preview],
        });
      } else {
        existing.taskPreviews.push(preview);
      }
    }

    return Array.from(byAuthor.values()).sort(
      (a, b) =>
        new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, memberById, userId, seenTick]);

  /** Unique authors of most recent task messages (no duplicates), newest first. */
  const recentAuthors = useMemo(() => {
    const seen = new Set<string>();
    const authors: {
      authorKey: string;
      authorUserId: string | null;
      authorName: string;
      authorAvatarUrl: string | null;
      accentColor: string;
    }[] = [];
    for (const preview of Object.values(latestByTask).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )) {
      const key = preview.authorUserId ?? `name:${preview.authorName}`;
      if (seen.has(key)) continue;
      seen.add(key);
      authors.push({
        authorKey: key,
        authorUserId: preview.authorUserId,
        authorName: preview.authorName,
        authorAvatarUrl: preview.authorAvatarUrl,
        accentColor: preview.accentColor,
      });
    }
    return authors;
  }, [latestByTask]);

  return {
    latestByTask,
    personThreads,
    recentAuthors,
    loading: query.isLoading,
    error: query.error,
  };
}
