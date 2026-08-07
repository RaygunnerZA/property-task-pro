import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";

type ThemeRow = Tables<"themes">;

/** Shared cache key — must match useThemes("category") so create/refresh syncs all consumers. */
export const categoriesQueryKey = (orgId: string | null | undefined) =>
  ["themes", orgId, "category"] as const;

export function useCategories() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  const query = useQuery({
    queryKey: categoriesQueryKey(orgId),
    queryFn: async (): Promise<ThemeRow[]> => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("themes")
        .select("*")
        .eq("org_id", orgId)
        .eq("type", "category")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !orgLoading && Boolean(orgId),
    staleTime: 60_000,
    retry: 1,
  });

  return {
    categories: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: async () => {
      await query.refetch();
    },
  };
}

// Note: category_members table was removed in themes migration
// This function is kept for backward compatibility but returns empty array
export function useCategoryMembers(categoryId?: string) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // category_members table no longer exists - themes system doesn't have members
    setMembers([]);
    setLoading(false);
  }, [categoryId]);

  return { members, loading, error, refresh: () => {} };
}

export function useTaskCategories(taskId?: string) {
  const [taskCategories, setTaskCategories] = useState<Tables<"task_themes">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTaskCategories() {
    if (!taskId) {
      setTaskCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Use task_themes junction table (replaces task_categories)
    const { data, error: err } = await supabase
      .from("task_themes")
      .select("*")
      .eq("task_id", taskId);

    if (err) setError(err.message);
    else setTaskCategories(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchTaskCategories();
  }, [taskId]);

  return { taskCategories, loading, error, refresh: fetchTaskCategories };
}
