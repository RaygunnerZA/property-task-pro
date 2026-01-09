import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useRealtime } from "../useRealtime";
import { useActiveOrg } from "../useActiveOrg";

type TaskRow = Tables<"tasks">;
type TaskImageRow = Tables<"task_images">;

export type TaskWithImage = TaskRow & {
  primary_image_url?: string | null;
};

/**
 * @deprecated This hook uses sequential queries and is slow. 
 * Use `useTasksQuery()` from `@/hooks/useTasksQuery` instead.
 * 
 * Migration: Replace `useTasks()` with `useTasksQuery()` and parse JSON arrays:
 * ```ts
 * const { data: tasksData = [], isLoading } = useTasksQuery();
 * const tasks = useMemo(() => {
 *   return tasksData.map((task: any) => ({
 *     ...task,
 *     spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
 *     themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
 *     teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
 *     assigned_user_id: task.assignee_user_id,
 *   }));
 * }, [tasksData]);
 * ```
 */
export function useTasks() {
  // Runtime warning in development
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '⚠️ useTasks() is deprecated and uses slow sequential queries.',
      'Migrate to useTasksQuery() from @/hooks/useTasksQuery for 10-25x better performance.',
      'See migration guide in hook JSDoc.'
    );
  }

  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [tasks, setTasks] = useState<TaskWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTasks() {
    if (!orgId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    // Fetch tasks filtered by org_id
    const { data: taskData, error: taskErr } = await supabase
      .from("tasks")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (taskErr) {
      setError(taskErr.message);
      setLoading(false);
      return;
    }

    // Fetch images from multiple sources
    const taskIds = taskData?.map(t => t.id) || [];
    let imageMap = new Map<string, string>();

    if (taskIds.length > 0) {
      // 1. Fetch task images (highest priority)
      const { data: taskImageData } = await supabase
        .from("task_images")
        .select("task_id, image_url")
        .in("task_id", taskIds)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      taskImageData?.forEach((img) => {
        if (img.task_id && img.image_url && !imageMap.has(img.task_id)) {
          imageMap.set(img.task_id, img.image_url);
        }
      });

      // 2. Fetch message attachment images (from conversations linked to tasks)
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, task_id")
        .in("task_id", taskIds)
        .eq("org_id", orgId);

      if (conversations && conversations.length > 0) {
        const conversationIds = conversations.map(c => c.id);
        const conversationToTask = new Map(conversations.map(c => [c.id, c.task_id]));

        // Get messages for these conversations
        const { data: messages } = await supabase
          .from("messages")
          .select("id, conversation_id")
          .in("conversation_id", conversationIds)
          .eq("org_id", orgId)
          .order("created_at", { ascending: false });

        if (messages && messages.length > 0) {
          const messageIds = messages.map(m => m.id);
          const messageToTask = new Map(
            messages.map(m => [m.id, conversationToTask.get(m.conversation_id)])
          );

          // Get image attachments from these messages
          const { data: attachments } = await supabase
            .from("attachments")
            .select("file_url, file_type, message_id")
            .in("message_id", messageIds)
            .eq("org_id", orgId)
            .like("file_type", "image/%")
            .order("created_at", { ascending: false });

          // Map most recent image attachment per task
          attachments?.forEach((att) => {
            const taskId = messageToTask.get(att.message_id);
            if (taskId && att.file_url && !imageMap.has(taskId)) {
              imageMap.set(taskId, att.file_url);
            }
          });
        }
      }

      // 3. Fetch property thumbnails
      const propertyIds = [...new Set(taskData?.filter(t => t.property_id).map(t => t.property_id) || [])];
      if (propertyIds.length > 0) {
        const { data: properties } = await supabase
          .from("properties")
          .select("id, thumbnail_url")
          .in("id", propertyIds)
          .eq("org_id", orgId);

        properties?.forEach((prop) => {
          if (prop.thumbnail_url) {
            // Find tasks with this property_id that don't have an image yet
            taskData?.forEach((task) => {
              if (task.property_id === prop.id && !imageMap.has(task.id) && prop.thumbnail_url) {
                imageMap.set(task.id, prop.thumbnail_url);
              }
            });
          }
        });
      }

      // 4. Fetch team images (from task_teams junction)
      const { data: taskTeams } = await supabase
        .from("task_teams")
        .select("task_id, team_id")
        .in("task_id", taskIds);

      if (taskTeams && taskTeams.length > 0) {
        const teamIds = [...new Set(taskTeams.map(tt => tt.team_id))];
        const taskToTeam = new Map(taskTeams.map(tt => [tt.task_id, tt.team_id]));

        const { data: teams } = await supabase
          .from("teams")
          .select("id, image_url")
          .in("id", teamIds)
          .eq("org_id", orgId);

        teams?.forEach((team) => {
          if (team.image_url) {
            // Find tasks with this team that don't have an image yet
            taskData?.forEach((task) => {
              const teamId = taskToTeam.get(task.id);
              if (teamId === team.id && !imageMap.has(task.id) && team.image_url) {
                imageMap.set(task.id, team.image_url);
              }
            });
          }
        });
      }

      // 5. Fetch theme images (from task_themes junction)
      const { data: taskThemes } = await supabase
        .from("task_themes")
        .select("task_id, theme_id")
        .in("task_id", taskIds);

      if (taskThemes && taskThemes.length > 0) {
        const themeIds = [...new Set(taskThemes.map(tt => tt.theme_id))];
        const taskToTheme = new Map(taskThemes.map(tt => [tt.task_id, tt.theme_id]));

        const { data: themes } = await supabase
          .from("themes")
          .select("id, metadata")
          .in("id", themeIds)
          .eq("org_id", orgId);

        themes?.forEach((theme) => {
          // Check if theme has image_url in metadata
          const imageUrl = (theme.metadata as any)?.image_url;
          if (imageUrl) {
            // Find tasks with this theme that don't have an image yet
            taskData?.forEach((task) => {
              const themeId = taskToTheme.get(task.id);
              if (themeId === theme.id && !imageMap.has(task.id)) {
                imageMap.set(task.id, imageUrl);
              }
            });
          }
        });
      }

      // 6. Fetch space images (from task_spaces junction -> attachments)
      const { data: taskSpaces } = await supabase
        .from("task_spaces")
        .select("task_id, space_id")
        .in("task_id", taskIds);

      if (taskSpaces && taskSpaces.length > 0) {
        const spaceIds = [...new Set(taskSpaces.map(ts => ts.space_id))];
        const taskToSpace = new Map(taskSpaces.map(ts => [ts.task_id, ts.space_id]));

        // Get image attachments for spaces
        const { data: spaceAttachments } = await supabase
          .from("attachments")
          .select("file_url, parent_id")
          .in("parent_id", spaceIds)
          .eq("parent_type", "space")
          .eq("org_id", orgId)
          .like("file_type", "image/%")
          .order("created_at", { ascending: false });

        // Map first image per space
        const spaceImageMap = new Map<string, string>();
        spaceAttachments?.forEach((att) => {
          if (att.parent_id && att.file_url && !spaceImageMap.has(att.parent_id)) {
            spaceImageMap.set(att.parent_id, att.file_url);
          }
        });

        // Apply space images to tasks
        taskData?.forEach((task) => {
          const spaceId = taskToSpace.get(task.id);
          if (spaceId && !imageMap.has(task.id)) {
            const spaceImage = spaceImageMap.get(spaceId);
            if (spaceImage) {
              imageMap.set(task.id, spaceImage);
            }
          }
        });
      }

      // 7. Fetch asset images (from attachments where parent_type = 'asset')
      // Note: Assets are linked via task_assets if that table exists, or we can check task metadata
      // For now, we'll check attachments directly for assets
      const { data: assetAttachments } = await supabase
        .from("attachments")
        .select("file_url, parent_id")
        .eq("parent_type", "asset")
        .eq("org_id", orgId)
        .like("file_type", "image/%")
        .order("created_at", { ascending: false });

      // If tasks have asset_ids in metadata or a separate table, we could link them here
      // For now, this is a placeholder for future asset-task linking
    }

    // Combine tasks with their primary image
    const tasksWithImages: TaskWithImage[] = (taskData || []).map((task) => ({
      ...task,
      primary_image_url: imageMap.get(task.id) || null,
    }));

    setTasks(tasksWithImages);
    setLoading(false);
  }

  useEffect(() => {
    // Wait for org to load before fetching tasks
    if (!orgLoading) {
      fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, orgLoading]);

  useRealtime("tasks", "tasks", fetchTasks);

  return { tasks, loading, error, refresh: fetchTasks };
}
