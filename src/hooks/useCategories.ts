import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";

type ThemeRow = Tables<"themes">;

export function useCategories() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [categories, setCategories] = useState<ThemeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchCategories() {
    if (!orgId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("themes")
      .select("*")
      .eq("org_id", orgId)
      .eq("type", "category")
      .order("created_at", { ascending: true });

    if (err) setError(err.message);
    else setCategories(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchCategories();
    }
  }, [orgId, orgLoading]);

  return { categories, loading, error, refresh: fetchCategories };
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

