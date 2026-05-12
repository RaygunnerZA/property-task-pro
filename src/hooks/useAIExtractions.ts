import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AIExtractionRow, AIModelRow } from "@/types/database";
import { useActiveOrg } from "./useActiveOrg";

export function useAIExtractions(taskId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [extractions, setExtractions] = useState<AIExtractionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchExtractions() {
    if (!orgId) {
      setExtractions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("ai_extractions")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (taskId) {
      query = query.eq("task_id", taskId);
    }

    const { data, error: err } = await query;

    if (err) setError(err.message);
    else setExtractions(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchExtractions();
    }
  }, [orgId, taskId, orgLoading]);

  return { extractions, loading, error, refresh: fetchExtractions };
}

export function useLatestAIExtraction(taskId?: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [extraction, setExtraction] = useState<AIExtractionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchLatest() {
    if (!orgId || !taskId) {
      setExtraction(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any)
      .from("ai_extractions")
      .select("*")
      .eq("org_id", orgId)
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (err) setError(err.message);
    else setExtraction(data);

    setLoading(false);
  }

  useEffect(() => {
    if (!orgLoading) {
      fetchLatest();
    }
  }, [orgId, taskId, orgLoading]);

  return { extraction, loading, error, refresh: fetchLatest };
}

export function useAIModels() {
  const [models, setModels] = useState<AIModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchModels() {
    setLoading(true);
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any)
      .from("ai_models")
      .select("*")
      .order("name", { ascending: true });

    if (err) setError(err.message);
    else setModels(data ?? []);

    setLoading(false);
  }

  useEffect(() => {
    fetchModels();
  }, []);

  return { models, loading, error, refresh: fetchModels };
}
