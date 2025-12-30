import { useEffect, useState, useCallback, useMemo } from "react";
import { useSupabase } from "../integrations/supabase/useSupabase";
import { useActiveOrg } from "./useActiveOrg";
import type { Tables } from "../integrations/supabase/types_new";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  // Additional fields from tasks_view
  property_name?: string | null;
  property_address?: string | null;
  property_thumbnail_url?: string | null;
  spaces?: Space[] | string; // Can be JSON string or array
  teams?: Team[] | string; // Can be JSON string or array
  themes?: any[] | string; // Can be JSON string or array
  images?: any[] | string; // Can be JSON string or array
  assignee_user_id?: string | null;
  // Parsed/computed fields
  property?: {
    id: string;
    nickname: string | null;
    address: string;
  } | null;
  categories?: Category[];
}

/**
 * Hook to fetch full task context by ID using tasks_view
 * Returns task data with all related information:
 * - Property (from tasks_view: property_name, property_address)
 * - Spaces (from tasks_view: spaces JSON array)
 * - Teams (from tasks_view: teams JSON array)
 * - Categories (still fetched separately as not in tasks_view yet)
 */
export function useTaskDetails(taskId: string | undefined) {
  const supabase = useSupabase();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const queryClient = useQueryClient();

  // Validate taskId format
  const isValidTaskId = useMemo(() => {
    return taskId && typeof taskId === 'string' && taskId.trim().length > 0;
  }, [taskId]);

  // Fetch task from tasks_view (includes property, spaces, teams)
  const { data: taskData, isLoading: taskLoading, error: taskError } = useQuery({
    queryKey: ["task-details", orgId, taskId],
    queryFn: async () => {
      if (!taskId || !orgId) return null;
      const { data, error } = await supabase
        .from("tasks_view")
        .select("*")
        .eq("id", taskId)
        .eq("org_id", orgId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orgId && !!taskId && isValidTaskId && !orgLoading,
    staleTime: 60000, // 1 minute
  });

  // Fetch categories separately (not in tasks_view yet)
  const { data: categoriesData } = useQuery({
    queryKey: ["task-categories", taskId],
    queryFn: async () => {
      if (!taskId || !orgId) return [];
      // Fetch theme IDs from task_themes junction table (categories are themes with type='category')
      const { data: taskThemes } = await supabase
        .from("task_themes")
        .select("theme_id")
        .eq("task_id", taskId);

      if (!taskThemes || taskThemes.length === 0) return [];

      const themeIds = taskThemes.map((item: any) => item.theme_id);
      
      // Fetch categories (now themes with type='category')
      const { data: categories } = await supabase
        .from("themes")
        .select("id, name, color, icon")
        .eq("type", "category")
        .in("id", themeIds);

      return (categories || []).map((category: any) => ({
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
      }));
    },
    enabled: !!taskId && !!orgId && isValidTaskId && !orgLoading,
    staleTime: 60000,
  });

  // Fetch task images from attachments table
  const { data: imagesData } = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      if (!taskId || !orgId) return [];
      const { data, error } = await supabase
        .from("attachments")
        .select("id, file_url, thumbnail_url, file_name, file_type, created_at, parent_type, parent_id, org_id")
        .eq("parent_type", "task")
        .eq("parent_id", taskId)
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching task attachments:", error);
        return [];
      }
      return (data || []).map((att: any) => ({
        id: att.id,
        file_url: att.file_url,
        thumbnail_url: att.thumbnail_url,
        file_name: att.file_name,
        file_type: att.file_type,
        created_at: att.created_at,
      }));
    },
    enabled: !!taskId && !!orgId && isValidTaskId && !orgLoading,
    staleTime: 60000,
  });

  // Parse and combine task data
  const task = useMemo(() => {
    if (!taskData) return null;

    // Parse JSON arrays from tasks_view
    const spaces: Space[] = typeof taskData.spaces === 'string' 
      ? JSON.parse(taskData.spaces) 
      : (taskData.spaces || []);
    
    const teams: Team[] = typeof taskData.teams === 'string'
      ? JSON.parse(taskData.teams)
      : (taskData.teams || []);

    // Extract property data from tasks_view
    const property = taskData.property_id ? {
      id: taskData.property_id,
      nickname: taskData.property_name || null,
      address: taskData.property_address || '',
    } : null;

    // Get primary image URL (first image, prefer thumbnail)
    const primaryImageUrl = imagesData && imagesData.length > 0 
      ? (imagesData[0].thumbnail_url || imagesData[0].file_url)
      : null;

    return {
      ...taskData,
      property,
      spaces,
      teams,
      categories: categoriesData || [],
      images: imagesData || [],
      primary_image_url: primaryImageUrl,
      assigned_user_id: taskData.assignee_user_id,
      // Ensure due_date is included from taskData
      due_date: (taskData as any).due_date || null,
      title: (taskData as any).title || null,
      description: (taskData as any).description || null,
    } as TaskDetails & { images: any[]; primary_image_url: string | null; due_date: string | null; title: string | null; description: string | null };
  }, [taskData, categoriesData, imagesData]);

  const loading = taskLoading || orgLoading;
  const error = taskError ? (taskError as any).message || String(taskError) : null;

  return { 
    task, 
    loading, 
    error, 
    refresh: () => {
      // Invalidate all related queries to force refetch
      queryClient.invalidateQueries({ queryKey: ["task-details", orgId, taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task-categories", taskId] });
    }
  };
}

