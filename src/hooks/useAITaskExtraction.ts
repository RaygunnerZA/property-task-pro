import { useState, useEffect } from "react";
import { useDebounce } from "./useDebounce";
import { useDataContext } from "@/contexts/DataContext";

interface GhostChip {
  name: string;
  exists: boolean;
  id?: string;
}

interface ThemeSuggestion {
  name: string;
  exists: boolean;
  id?: string;
  type?: 'category' | 'project' | 'tag' | 'group';
}

interface ExtractResponse {
  ok: boolean;
  combined: {
    title: string | null;
    spaces: GhostChip[];
    people: GhostChip[];
    teams: GhostChip[];
    assets: string[];
    priority: string | null;
    date: string | null;
    themes: ThemeSuggestion[];
    yes_no: boolean;
    signature: boolean;
  };
}

export interface AIExtractionResult {
  title: string | null;
  spaces: GhostChip[];
  people: GhostChip[];
  teams: GhostChip[];
  assets: string[];
  priority: string | null;
  date: string | null;
    themes: ThemeSuggestion[];
  yes_no: boolean;
  signature: boolean;
}

export function useAITaskExtraction(description: string) {
  const debounced = useDebounce(description, 400);
  const { orgId } = useDataContext();

  const [aiTitle, setAiTitle] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<AIExtractionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!debounced.trim() || !orgId) {
      setAiTitle("");
      setAiSuggestions(null);
      return;
    }

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("https://tuyflmyojrmvlbptnpcg.supabase.co/functions/v1/ai-extract", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ description: debounced, org_id: orgId }),
        });

        const data: ExtractResponse = await res.json();

        if (data.ok) {
          setAiSuggestions(data.combined);
          if (data.combined.title) {
            setAiTitle(data.combined.title);
          }
        } else {
          setError("AI extraction failed");
        }
      } catch (err: any) {
        console.error("AI extraction error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [debounced, orgId]);

  return { aiTitle, aiSuggestions, loading, error };
}
