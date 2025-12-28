import { useEffect, useState, useCallback, useMemo } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import type { Tables } from "../integrations/supabase/types";

type TaskRow = Tables<"tasks">;

interface Space {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
}

interface Category {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
}

interface TaskDetails extends TaskRow {
  property?: {
    id: string;
    nickname: string | null;
    address: string;
  } | null;
  spaces?: Space[];
  teams?: Team[];
  categories?: Category[];
}

/**
 * Hook to fetch full task context by ID
 * Returns task data with all related information:
 * - Property (if property_id exists)
 * - Spaces (via task_spaces junction table)
 * - Teams (via task_teams junction table)
 * - Categories (via task_categories junction table)
 */
export function useTaskDetails(taskId: string | undefined) {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate taskId format
  const isValidTaskId = useMemo(() => {
    return taskId && typeof taskId === 'string' && taskId.trim().length > 0;
  }, [taskId]);

  const fetchTaskDetails = useCallback(async () => {
    if (!isValidTaskId) {
      setTask(null);
      setLoading(false);
      setError(taskId ? "Invalid task ID" : "No task ID provided");
      return;
    }

    // Wait for orgId to be available
    if (!orgId) {
      setLoading(true);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch task
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .eq("org_id", orgId)
        .single();

      if (taskError) {
        console.error("Error fetching task:", taskError);
        throw taskError;
      }

      if (!taskData) {
        console.warn(`Task not found: taskId=${taskId}, orgId=${orgId}`);
        setError(`Task not found. Please check that the task exists and belongs to your organization.`);
        setTask(null);
        setLoading(false);
        return;
      }

      // Fetch all related data in parallel
      const [propertyResult, taskSpacesResult, taskTeamsResult, taskCategoriesResult] = await Promise.all([
        // Fetch property if property_id exists
        taskData.property_id
          ? supabase
              .from("properties")
              .select("id, nickname, address")
              .eq("id", taskData.property_id)
              .single()
          : Promise.resolve({ data: null, error: null }),

        // Fetch space IDs from task_spaces junction table
        supabase
          .from("task_spaces")
          .select("space_id")
          .eq("task_id", taskId),

        // Fetch team IDs from task_teams junction table
        supabase
          .from("task_teams")
          .select("team_id")
          .eq("task_id", taskId),

        // Fetch category IDs from task_categories junction table
        supabase
          .from("task_categories")
          .select("category_id")
          .eq("task_id", taskId),
      ]);

      // Extract IDs from junction tables
      const spaceIds = (taskSpacesResult.data || []).map((item: any) => item.space_id);
      const teamIds = (taskTeamsResult.data || []).map((item: any) => item.team_id);
      const categoryIds = (taskCategoriesResult.data || []).map((item: any) => item.category_id);

      // Fetch related entities in parallel
      const [spacesResult, teamsResult, categoriesResult] = await Promise.all([
        // Fetch spaces
        spaceIds.length > 0
          ? supabase
              .from("spaces")
              .select("id, name")
              .in("id", spaceIds)
          : Promise.resolve({ data: [], error: null }),

        // Fetch teams
        teamIds.length > 0
          ? supabase
              .from("teams")
              .select("id, name, color, icon")
              .in("id", teamIds)
          : Promise.resolve({ data: [], error: null }),

        // Fetch categories
        categoryIds.length > 0
          ? supabase
              .from("categories")
              .select("id, name, color, icon")
              .in("id", categoryIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      // Extract and format related data
      const property = propertyResult.data || null;

      const spaces: Space[] = (spacesResult.data || []).map((space: any) => ({
        id: space.id,
        name: space.name,
      }));

      const teams: Team[] = (teamsResult.data || []).map((team: any) => ({
        id: team.id,
        name: team.name,
        color: team.color,
        icon: team.icon,
      }));

      const categories: Category[] = (categoriesResult.data || []).map((category: any) => ({
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
      }));

      // Combine all data
      setTask({
        ...taskData,
        property,
        spaces,
        teams,
        categories,
      } as TaskDetails);
    } catch (err: any) {
      console.error("Error fetching task details:", err);
      const errorMessage = err.message || "Failed to fetch task details";
      // Provide more helpful error messages
      if (err.code === 'PGRST116') {
        setError("Task not found. The task may have been deleted or you may not have permission to view it.");
      } else {
        setError(errorMessage);
      }
      setTask(null);
    } finally {
      setLoading(false);
    }
    }, [supabase, orgId, taskId, isValidTaskId]);

  useEffect(() => {
    // Only fetch when org is loaded and we have both orgId and valid taskId
    if (!orgLoading && orgId && isValidTaskId) {
      fetchTaskDetails();
    } else if (!orgLoading && !orgId && isValidTaskId) {
      // Org loaded but no orgId - set error
      setError("Organization not found");
      setLoading(false);
    } else if (!orgLoading && isValidTaskId) {
      // Still loading org
      setLoading(true);
    } else if (!isValidTaskId && !orgLoading) {
      // Invalid taskId and org is loaded
      setError("Invalid task ID");
      setLoading(false);
    }
  }, [fetchTaskDetails, orgLoading, orgId, taskId, isValidTaskId]);

  return { task, loading, error, refresh: fetchTaskDetails };
}

