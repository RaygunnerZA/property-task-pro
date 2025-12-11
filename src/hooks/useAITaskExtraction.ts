import { useState, useEffect } from "react";
import { useDebounce } from "./useDebounce";

interface ExtractResponse {
  ok: boolean;
  combined: {
    title: string | null;
    spaces: string[];
    people: string[];
    assets: string[];
    priority: string | null;
    date: string | null;
    groups: string[];
    yes_no: boolean;
    signature: boolean;
  };
}

export interface AIExtractionResult {
  title: string | null;
  spaces: string[];
  people: string[];
  assets: string[];
  priority: string | null;
  date: string | null;
  groups: string[];
  yes_no: boolean;
  signature: boolean;
}

export function useAITaskExtraction(description: string) {
  const debounced = useDebounce(description, 400);

  const [aiTitle, setAiTitle] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<AIExtractionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!debounced.trim()) {
      setAiTitle("");
      setAiSuggestions(null);
      return;
    }

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          "https://tuyflmyojrmvlbptnpcg.supabase.co/functions/v1/ai-extract",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1eWZsbXlvanJtdmxicHRucGNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MDQzODgsImV4cCI6MjA3OTM4MDM4OH0.d7GXscABiRLiG-Gu89Cd8RRqfg7tVoJZ1quZ1ZfSixE`
            },
            body: JSON.stringify({ description: debounced }),
          }
        );

        const data: ExtractResponse = await response.json();

        if (data.ok) {
          setAiSuggestions(data.combined);
          if (data.combined.title) {
            setAiTitle(data.combined.title);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [debounced]);

  return { aiTitle, aiSuggestions, loading, error };
}
