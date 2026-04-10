import { useState, useEffect, useRef, useCallback } from "react";
import { useActiveOrg } from "./useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

/** Minimum trimmed length before calling ai-extract */
const MIN_DESCRIPTION_LENGTH = 8;

/** Minimum gap between completed API calls (ms) */
const AI_CALL_COOLDOWN_MS = 2000;

/** After sentence-ending punctuation (. ? ! …), user likely finished a clause — shorter wait */
const DEBOUNCE_AFTER_SENTENCE_MS = 650;

/** After normal typing (incl. spaces mid-word), wait for a typing pause */
const DEBOUNCE_IDLE_MS = 2300;

/** Collapse whitespace for dedupe — avoids re-calling on `word` vs `word ` vs `word  ` */
function normalizeForDedupe(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Sentence / clause boundary cue (not comma — often mid-list) */
function endsWithSentenceCue(raw: string): boolean {
  return /[.!?…][\s]*$/u.test(raw);
}

export interface ThemeSuggestion {
  name: string;
  exists: boolean;
  id?: string;
  type?: "category" | "project" | "tag" | "group";
  authority?: number;
}

export interface AIExtractResponse {
  ok: boolean;
  combined: {
    title: string | null;
    spaces: Array<{ name: string; exists: boolean; id?: string; authority?: number }>;
    people: Array<{ name: string; exists: boolean; id?: string; authority?: number }>;
    teams: Array<{ name: string; exists: boolean; id?: string; authority?: number }>;
    themes: ThemeSuggestion[];
    assets: Array<{ name: string; authority?: number }> | string[];
    priority: string | null;
    date: string | null;
    yes_no: boolean;
    signature: boolean;
  };
  error?: string;
}

export function useAIExtract(input: string) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const [result, setResult] = useState<AIExtractResponse["combined"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef(input);
  inputRef.current = input;

  /** Normalized form of last successful extract — skip identical content */
  const lastSuccessNormalizedRef = useRef<string>("");
  const lastCallTimeRef = useRef<number>(0);
  const isProcessingRef = useRef(false);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimer = useCallback(() => {
    if (pendingTimerRef.current != null) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  }, []);

  const extractNow = useCallback(
    async (inputToProcess: string) => {
      const trimmed = inputToProcess.trim();
      const normalized = normalizeForDedupe(inputToProcess);

      if (trimmed.length < MIN_DESCRIPTION_LENGTH) return;
      if (isProcessingRef.current) return;
      if (normalized === lastSuccessNormalizedRef.current) return;

      isProcessingRef.current = true;
      lastCallTimeRef.current = Date.now();

      setLoading(true);
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setError("Not authenticated");
          isProcessingRef.current = false;
          setLoading(false);
          return;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const functionUrl = `${supabaseUrl}/functions/v1/ai-extract`;

        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            description: trimmed,
            org_id: orgId,
          }),
        });

        const responseText = await response.text();
        let responseData: unknown;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        const data = responseData as AIExtractResponse;

        if (data.ok && data.combined) {
          setResult(data.combined);
          lastSuccessNormalizedRef.current = normalized;
          track("ai_task_generated", {
            org_id: orgId,
            chip_count:
              (data.combined.spaces?.length ?? 0) +
              (data.combined.people?.length ?? 0) +
              (data.combined.teams?.length ?? 0) +
              (data.combined.assets?.length ?? 0) +
              (data.combined.themes?.length ?? 0),
          });
        } else {
          setError(data.error || "AI extraction failed");
          setResult(null);
          lastSuccessNormalizedRef.current = "";
        }
      } catch (err: unknown) {
        console.error("AI extract error:", err);
        setError(err instanceof Error ? err.message : "Failed to extract");
        setResult(null);
        lastSuccessNormalizedRef.current = "";
      } finally {
        setLoading(false);
        isProcessingRef.current = false;
      }
    },
    [orgId]
  );

  useEffect(() => {
    clearPendingTimer();

    const raw = input;
    const trimmed = raw.trim();

    if (!trimmed || !orgId || orgLoading) {
      if (!trimmed) {
        lastSuccessNormalizedRef.current = "";
      }
      setResult(null);
      setLoading(false);
      return;
    }

    if (trimmed.length < MIN_DESCRIPTION_LENGTH) {
      return;
    }

    const normalized = normalizeForDedupe(raw);
    if (normalized === lastSuccessNormalizedRef.current) {
      return;
    }

    const delayMs = endsWithSentenceCue(raw) ? DEBOUNCE_AFTER_SENTENCE_MS : DEBOUNCE_IDLE_MS;

    const runAfterDebounce = () => {
      const tryExtract = () => {
        pendingTimerRef.current = null;

        const latestRaw = inputRef.current;
        const latestTrimmed = latestRaw.trim();

        if (!latestTrimmed || !orgId || orgLoading) {
          return;
        }
        if (latestTrimmed.length < MIN_DESCRIPTION_LENGTH) {
          return;
        }

        const latestNorm = normalizeForDedupe(latestRaw);
        if (latestNorm === lastSuccessNormalizedRef.current) {
          return;
        }

        const elapsed = Date.now() - lastCallTimeRef.current;
        if (elapsed < AI_CALL_COOLDOWN_MS && lastCallTimeRef.current > 0) {
          pendingTimerRef.current = setTimeout(tryExtract, AI_CALL_COOLDOWN_MS - elapsed);
          return;
        }

        if (isProcessingRef.current) {
          pendingTimerRef.current = setTimeout(tryExtract, 280);
          return;
        }

        void extractNow(latestRaw);
      };

      tryExtract();
    };

    pendingTimerRef.current = setTimeout(runAfterDebounce, delayMs);

    return () => {
      clearPendingTimer();
    };
  }, [input, orgId, orgLoading, clearPendingTimer, extractNow]);

  return { result, loading, error };
}
