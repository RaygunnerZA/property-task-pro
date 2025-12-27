import { useState, useEffect } from "react";
import { useDebounce } from "./useDebounce";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export interface ThemeSuggestion {
  name: string;
  exists: boolean;
  id?: string;
  type?: 'category' | 'project' | 'tag' | 'group'; // AI-suggested subtype
}

export interface AIExtractResponse {
  ok: boolean;
  combined: {
    title: string | null;
    spaces: Array<{ name: string; exists: boolean; id?: string }>;
    people: Array<{ name: string; exists: boolean; id?: string }>;
    teams: Array<{ name: string; exists: boolean; id?: string }>;
    themes: ThemeSuggestion[];
    assets: string[];
    priority: string | null;
    date: string | null;
    yes_no: boolean;
    signature: boolean;
  };
  error?: string;
}

export function useAIExtract(input: string) {
  const debouncedInput = useDebounce(input, 500); // 500ms debounce
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [result, setResult] = useState<AIExtractResponse["combined"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!debouncedInput.trim() || !orgId || orgLoading) {
      setResult(null);
      setLoading(false);
      return;
    }

    async function extract() {
      setLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("Not authenticated");
          return;
        }

        // Get Supabase URL from environment
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const functionUrl = `${supabaseUrl}/functions/v1/ai-extract`;

        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            description: debouncedInput,
            org_id: orgId,
          }),
        });

        const data: AIExtractResponse = await response.json();

        if (data.ok && data.combined) {
          setResult(data.combined);
        } else {
          setError(data.error || "AI extraction failed");
          setResult(null);
        }
      } catch (err: any) {
        console.error("AI extract error:", err);
        setError(err.message || "Failed to extract");
        setResult(null);
      } finally {
        setLoading(false);
      }
    }

    extract();
  }, [debouncedInput, orgId, orgLoading]);

  return { result, loading, error };
}

