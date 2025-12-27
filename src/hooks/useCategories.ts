import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useActiveOrg } from "./useActiveOrg";

type CategoryRow = Tables<"categories">;

export function useCategories() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
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
      .from("categories")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_archived", false)
      .order("display_order", { ascending: true });

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

export function useCategoryMembers(categoryId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [members, setMembers] = useState<Tables<"category_members">[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchMembers() {
    if (!orgId || !categoryId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("category_members")
      .select("*")
      .eq("category_id", categoryId)
      .eq("is_deleted", false);

    if (err) setError(err.message);
    else setMembers(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchMembers();
    }
  }, [orgId, categoryId, orgLoading]);

  return { members, loading, error, refresh: fetchMembers };
}

export function useTaskCategories(taskId?: string) {
  const [taskCategories, setTaskCategories] = useState<Tables<"task_categories">[]>([]);
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

    const { data, error: err } = await supabase
      .from("task_categories")
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

