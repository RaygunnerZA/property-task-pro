-- Forward: AI capability evals + resolution audit (were archive-only after the 2026-08-17 squash).
-- Canonical: @Docs/03_Data_Model.md, @Docs/07_AI_Intelligence.md, @Docs/21_Data_Lifecycle.md
--
-- Platform-scoped evals: no org policy. Org-scoped resolution audit: membership only,
-- append-only (no UPDATE/DELETE policies).

-- ---------------------------------------------------------------------------
-- ai_resolution_audit — client already writes this; missing from baseline.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_resolution_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_temp_id TEXT,
  suggestion_payload JSONB NOT NULL,
  chosen_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_resolution_audit_org_user
  ON public.ai_resolution_audit (org_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_resolution_audit_task
  ON public.ai_resolution_audit (task_temp_id)
  WHERE task_temp_id IS NOT NULL;

ALTER TABLE public.ai_resolution_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read audit logs for their org" ON public.ai_resolution_audit;
DROP POLICY IF EXISTS "Users can insert audit logs for their org" ON public.ai_resolution_audit;
DROP POLICY IF EXISTS ai_resolution_audit_select ON public.ai_resolution_audit;
DROP POLICY IF EXISTS ai_resolution_audit_insert ON public.ai_resolution_audit;

CREATE POLICY ai_resolution_audit_select ON public.ai_resolution_audit
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY ai_resolution_audit_insert ON public.ai_resolution_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_member(org_id)
  );

REVOKE ALL ON public.ai_resolution_audit FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.ai_resolution_audit TO authenticated;
GRANT ALL ON public.ai_resolution_audit TO service_role;

-- ---------------------------------------------------------------------------
-- ai_capability_evals — golden-set scores; platform admin SELECT only.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_capability_evals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  provider TEXT NOT NULL,
  fixture_set TEXT NOT NULL,
  fixture_count INTEGER NOT NULL DEFAULT 0,
  recall NUMERIC(5, 4),
  false_positive_rate NUMERIC(5, 4),
  schema_valid_rate NUMERIC(5, 4),
  latency_ms_p50 INTEGER,
  cost_usd NUMERIC(12, 8),
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

DROP POLICY IF EXISTS ai_capability_evals_select_admin ON public.ai_capability_evals;
CREATE POLICY ai_capability_evals_select_admin ON public.ai_capability_evals
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON public.ai_capability_evals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_capability_evals TO authenticated;
GRANT ALL ON public.ai_capability_evals TO service_role;

-- ---------------------------------------------------------------------------
-- Production-derived plan extraction metrics (cross-org, platform admin).
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'platform',
    auth.uid(),
    'admin.ai.plan_extraction_metrics_viewed',
    jsonb_build_object('since', p_since, 'timestamp', now())
  );

  RETURN QUERY
  WITH runs AS (
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
  ORDER BY 4 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ai_plan_extraction_metrics(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_ai_plan_extraction_metrics(TIMESTAMPTZ)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Suggestion correction rate (not model-attributable until ai_request_id exists).
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'platform',
    auth.uid(),
    'admin.ai.resolution_metrics_viewed',
    jsonb_build_object('since', p_since, 'timestamp', now())
  );

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
  ORDER BY 1 DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ai_resolution_metrics(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_ai_resolution_metrics(TIMESTAMPTZ)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Record a golden-set eval. Service role only (eval harness), never the app.
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
