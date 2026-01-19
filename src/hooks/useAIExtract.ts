import { useState, useEffect, useRef } from "react";
import { useDebounce } from "./useDebounce";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

// Minimum description length before making expensive AI calls
const MIN_DESCRIPTION_LENGTH = 10;

// Cooldown period between AI calls (ms) - prevents rapid successive calls
const AI_CALL_COOLDOWN = 2000;

export interface ThemeSuggestion {
  name: string;
  exists: boolean;
  id?: string;
  type?: 'category' | 'project' | 'tag' | 'group'; // AI-suggested subtype
  authority?: number; // Internal authority score (0-1)
}

export interface AIExtractResponse {
  ok: boolean;
  combined: {
    title: string | null;
    spaces: Array<{ name: string; exists: boolean; id?: string; authority?: number }>;
    people: Array<{ name: string; exists: boolean; id?: string; authority?: number }>;
    teams: Array<{ name: string; exists: boolean; id?: string; authority?: number }>;
    themes: ThemeSuggestion[];
    assets: Array<{ name: string; authority?: number }> | string[]; // Support both formats for backward compatibility
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
  
  // Track last processed description to avoid reprocessing the same text
  const lastProcessedRef = useRef<string>("");
  const lastCallTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);

  useEffect(() => {
    const trimmedInput = debouncedInput.trim();
    
    // Clear result if input is empty
    if (!trimmedInput || !orgId || orgLoading) {
      if (trimmedInput === "") {
        // Only clear when description is actually empty, not on loading states
        lastProcessedRef.current = "";
      }
      setResult(null);
      setLoading(false);
      return;
    }

    // Skip if description hasn't actually changed (content comparison, not reference)
    if (lastProcessedRef.current === trimmedInput) {
      return;
    }

    // Skip if description is too short (not enough context for AI)
    if (trimmedInput.length < MIN_DESCRIPTION_LENGTH) {
      return;
    }

    // Skip if already processing to prevent duplicate calls
    if (isProcessingRef.current) {
      return;
    }

    // Define extract function that can be called immediately or from setTimeout
    async function extractNow(inputToProcess: string) {
      // Double-check we're not already processing and input hasn't changed
      if (isProcessingRef.current || lastProcessedRef.current === inputToProcess) {
        return;
      }

      // Mark as processing and update last call time
      isProcessingRef.current = true;
      lastCallTimeRef.current = Date.now();
      
      // Update last processed BEFORE the async call to prevent duplicates
      // if the component re-renders during the call
      lastProcessedRef.current = inputToProcess;
      
      setLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("Not authenticated");
          isProcessingRef.current = false;
          lastProcessedRef.current = "";
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
            description: inputToProcess,
            org_id: orgId,
          }),
        });

        const responseStatus = response.status;
        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

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
        } else {
          setError(data.error || "AI extraction failed");
          setResult(null);
          // Reset last processed on error so user can retry
          lastProcessedRef.current = "";
        }
      } catch (err: any) {
        console.error("AI extract error:", err);
        setError(err.message || "Failed to extract");
        setResult(null);
        // Reset last processed on error so user can retry
        lastProcessedRef.current = "";
      } finally {
        setLoading(false);
        isProcessingRef.current = false;
      }
    }

    // Rate limiting: Check if we're within cooldown period
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTimeRef.current;
    if (timeSinceLastCall < AI_CALL_COOLDOWN) {
      // Schedule call after cooldown expires
      const remainingCooldown = AI_CALL_COOLDOWN - timeSinceLastCall;
      const inputToProcess = trimmedInput; // Capture current input
      const timeoutId = setTimeout(() => {
        // Re-check conditions before processing
        if (lastProcessedRef.current !== inputToProcess &&
            inputToProcess.length >= MIN_DESCRIPTION_LENGTH &&
            !isProcessingRef.current) {
          // Process the input that was pending
          extractNow(inputToProcess);
        }
      }, remainingCooldown);
      
      return () => clearTimeout(timeoutId);
    }

    // Call immediately if not in cooldown
    extractNow(trimmedInput);
  }, [debouncedInput, orgId, orgLoading]);

  return { result, loading, error };
}

