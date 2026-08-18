-- AI capability evaluation (Phase 2 of the AI call boundary).
-- Canonical definitions: @Docs/03_Data_Model.md, @Docs/07_AI_Intelligence.md
--
-- Two sources of truth, deliberately separated:
--   1. Production-derived metrics — what real reviewers corrected or rejected.
--      Representative but not comparable across time (inputs differ).
--   2. Golden-set evals (ai_capability_evals) — comparable but not representative.
--      Used to compare a candidate (model, prompt_version) against the incumbent.
--
-- Quality never lives in the route config: it gates promotion decisions offline.

CREATE TABLE IF NOT EXISTS public.ai_capability_evals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability TEXT NOT NULL,
  -- A model is only meaningful together with the prompt it was given.
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  provider TEXT NOT NULL,
  /** Identifier of the fixture set, so scores are only compared like-for-like. */
  fixture_set TEXT NOT NULL,
  fixture_count INTEGER NOT NULL DEFAULT 0,
  recall NUMERIC(5, 4),
  false_positive_rate NUMERIC(5, 4),
  schema_valid_rate NUMERIC(5, 4),
  latency_ms_p50 INTEGER,
  cost_usd NUMERIC(12, 8),
  /** Per-fixture detail for debugging a regression. */
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_capability_evals_capability_idx
  ON public.ai_capability_evals (capability, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_capability_evals_model_idx
  ON public.ai_capability_evals (model, prompt_version, created_at DESC);

ALTER TABLE public.ai_capability_evals ENABLE ROW LEVEL SECURITY;

-- Platform-scope only. Unlike ai_requests, orgs have no interest in and no claim
-- to platform model-selection data, and it is not org-scoped.
DROP POLICY IF EXISTS ai_capability_evals_select_admin ON public.ai_capability_evals;
CREATE POLICY ai_capability_evals_select_admin ON public.ai_capability_evals
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

GRANT SELECT ON public.ai_capability_evals TO authenticated;
GRANT ALL ON public.ai_capability_evals TO service_role;

-- ---------------------------------------------------------------------------
-- Production-derived metrics: plan label extraction
--
-- extracted_spaces already records ground truth produced by real reviewers:
--   corrected  = edited_name IS NOT NULL (reviewer kept it but fixed the label)
--   rejected   = is_accepted = false     (reviewer threw it away)
--   imported   = imported_space_id IS NOT NULL
--
-- Attribution to a model is exact because building-plan-process records
-- extraction_run_id in ai_requests.metadata.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_ai_plan_extraction_metrics(
  p_since TIMESTAMPTZ DEFAULT (now() - INTERVAL '90 days')
)
RETURNS TABLE (
  model TEXT,
  prompt_version TEXT,
  provider TEXT,
  proposals BIGINT,
  corrected BIGINT,
  rejected BIGINT,
  imported BIGINT,
  correction_rate NUMERIC,
  rejection_rate NUMERIC,
  acceptance_rate NUMERIC,
  avg_confidence NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH runs AS (
    -- One row per (extraction run, model) that actually produced output.
    SELECT DISTINCT
      (r.metadata->>'extraction_run_id')::uuid AS extraction_run_id,
      r.model_used,
      COALESCE(r.prompt_version, 'unversioned') AS prompt_version,
      r.provider
    FROM ai_requests r
    WHERE r.function_name = 'building-plan-process'
      AND r.status IN ('success', 'fallback')
      AND r.created_at >= p_since
      AND r.metadata ? 'extraction_run_id'
  )
  SELECT
    runs.model_used AS model,
    runs.prompt_version,
    runs.provider,
    COUNT(*)::BIGINT AS proposals,
    COUNT(*) FILTER (WHERE es.edited_name IS NOT NULL)::BIGINT AS corrected,
    COUNT(*) FILTER (WHERE es.is_accepted = false)::BIGINT AS rejected,
    COUNT(*) FILTER (WHERE es.imported_space_id IS NOT NULL)::BIGINT AS imported,
    ROUND(
      COUNT(*) FILTER (WHERE es.edited_name IS NOT NULL)::NUMERIC
        / GREATEST(COUNT(*), 1), 4
    ) AS correction_rate,
    ROUND(
      COUNT(*) FILTER (WHERE es.is_accepted = false)::NUMERIC
        / GREATEST(COUNT(*), 1), 4
    ) AS rejection_rate,
    ROUND(
      COUNT(*) FILTER (WHERE es.is_accepted AND es.edited_name IS NULL)::NUMERIC
        / GREATEST(COUNT(*), 1), 4
    ) AS acceptance_rate,
    ROUND(AVG(es.confidence), 4) AS avg_confidence
  FROM runs
  JOIN extracted_spaces es ON es.extraction_run_id = runs.extraction_run_id
  GROUP BY runs.model_used, runs.prompt_version, runs.provider
  -- Ordinal, not the alias: `proposals` is also a RETURNS TABLE output parameter,
  -- so an unqualified reference to it here is ambiguous in plpgsql.
  ORDER BY 4 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_ai_plan_extraction_metrics(TIMESTAMPTZ)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Production-derived metrics: suggestion acceptance platform-wide
--
-- ai_resolution_audit records what AI suggested against what the user chose.
-- It carries no link to ai_requests, so these numbers are NOT attributable to a
-- model. They track whether suggestion quality is drifting, not which model won.
-- Attribution needs the client to persist the originating ai_requests id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_ai_resolution_metrics(
  p_since TIMESTAMPTZ DEFAULT (now() - INTERVAL '90 days')
)
RETURNS TABLE (
  day DATE,
  suggestions BIGINT,
  corrections BIGINT,
  correction_rate NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.created_at::date AS day,
    COUNT(*)::BIGINT AS suggestions,
    COUNT(*) FILTER (WHERE a.suggestion_payload <> a.chosen_payload)::BIGINT AS corrections,
    ROUND(
      COUNT(*) FILTER (WHERE a.suggestion_payload <> a.chosen_payload)::NUMERIC
        / GREATEST(COUNT(*), 1), 4
    ) AS correction_rate
  FROM ai_resolution_audit a
  WHERE a.created_at >= p_since
  GROUP BY a.created_at::date
  -- Ordinal: `day` is also a RETURNS TABLE output parameter.
  ORDER BY 1 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_ai_resolution_metrics(TIMESTAMPTZ)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Record a golden-set eval run. Service role only: eval runs come from the
-- scripts/run-ai-eval.mjs harness, never from the app.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_ai_capability_eval(
  p_capability TEXT,
  p_model TEXT,
  p_prompt_version TEXT,
  p_provider TEXT,
  p_fixture_set TEXT,
  p_fixture_count INTEGER,
  p_recall NUMERIC DEFAULT NULL,
  p_false_positive_rate NUMERIC DEFAULT NULL,
  p_schema_valid_rate NUMERIC DEFAULT NULL,
  p_latency_ms_p50 INTEGER DEFAULT NULL,
  p_cost_usd NUMERIC DEFAULT NULL,
  p_detail JSONB DEFAULT '{}'::jsonb,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO ai_capability_evals (
    capability, model, prompt_version, provider, fixture_set, fixture_count,
    recall, false_positive_rate, schema_valid_rate, latency_ms_p50, cost_usd,
    detail, notes, created_by
  ) VALUES (
    p_capability, p_model, p_prompt_version, p_provider, p_fixture_set,
    COALESCE(p_fixture_count, 0), p_recall, p_false_positive_rate,
    p_schema_valid_rate, p_latency_ms_p50, p_cost_usd,
    COALESCE(p_detail, '{}'::jsonb), p_notes, auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ai_capability_eval(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, NUMERIC, NUMERIC, INTEGER,
  NUMERIC, JSONB, TEXT
) FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.record_ai_capability_eval(
  TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, NUMERIC, NUMERIC, INTEGER,
  NUMERIC, JSONB, TEXT
) TO service_role;
