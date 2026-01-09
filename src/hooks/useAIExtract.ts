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

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAIExtract.ts:44',message:'Starting AI extraction',data:{debouncedInput,debouncedInputLength:debouncedInput.length,orgId,orgLoading,hasInput:!!debouncedInput.trim()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      try {
        const { data: { session } } = await supabase.auth.getSession();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAIExtract.ts:49',message:'Session check',data:{hasSession:!!session,hasAccessToken:!!session?.access_token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        if (!session) {
          setError("Not authenticated");
          return;
        }

        // Get Supabase URL from environment
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const functionUrl = `${supabaseUrl}/functions/v1/ai-extract`;

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAIExtract.ts:57',message:'Making API call',data:{functionUrl,hasSupabaseUrl:!!supabaseUrl,requestBody:{description:debouncedInput,org_id:orgId}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

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

        // #region agent log
        const responseStatus = response.status;
        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAIExtract.ts:71',message:'API response received',data:{status:responseStatus,ok:responseData?.ok,hasCombined:!!responseData?.combined,combinedTitle:responseData?.combined?.title,combinedPriority:responseData?.combined?.priority,error:responseData?.error,responseData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion

        // Log exact response for debugging
        console.log('[useAIExtract] Function Response:', {
          status: responseStatus,
          statusText: response.statusText,
          ok: response.ok,
          responseData: responseData,
          responseText: responseText.substring(0, 500), // First 500 chars
        });

        const data: AIExtractResponse = responseData as AIExtractResponse;

        if (data.ok && data.combined) {
          setResult(data.combined);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAIExtract.ts:74',message:'AI result set successfully',data:{title:data.combined.title,priority:data.combined.priority,date:data.combined.date,spacesCount:data.combined.spaces.length,peopleCount:data.combined.people.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
        } else {
          setError(data.error || "AI extraction failed");
          setResult(null);
        }
      } catch (err: any) {
        console.error("AI extract error:", err);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useAIExtract.ts:79',message:'AI extraction error caught',data:{error:err?.message,stack:err?.stack,name:err?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
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

