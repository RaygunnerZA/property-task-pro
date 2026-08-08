-- Enforce BRAIN_MIN_COHORT = 5 on Filla Brain inference RPCs.
-- Below threshold: return zero-sample fallbacks (never smoothed single-org globals).

CREATE OR REPLACE FUNCTION public.brain_min_cohort()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 5;
$$;

COMMENT ON FUNCTION public.brain_min_cohort() IS
  'Minimum sample_count before anonymised Brain / Community Knowledge stats may surface. Enforced in SQL, never by LLM.';

CREATE OR REPLACE FUNCTION public.brain_infer_asset(p_vector JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, filla_brain
AS $$
DECLARE
  v_result JSONB;
  v_sample BIGINT;
  v_min INT := public.brain_min_cohort();
BEGIN
  SELECT
    COALESCE(SUM(bap.sample_count), 0),
    jsonb_build_object(
      'failure_probability', COALESCE(AVG(bap.failure_probability), 0.1),
      'mean_time_to_failure_days', COALESCE((AVG(bap.mean_time_to_failure_days))::INT, 365),
      'hazard_correlation', COALESCE(MAX(bap.hazard_correlation), '{}'),
      'sample_count', COALESCE(SUM(bap.sample_count), 0)
    )
  INTO v_sample, v_result
  FROM filla_brain.brain_asset_patterns bap
  WHERE bap.asset_vector @> p_vector OR p_vector @> bap.asset_vector;

  IF v_sample IS NULL OR v_sample < v_min THEN
    RETURN jsonb_build_object(
      'failure_probability', 0.1,
      'mean_time_to_failure_days', 365,
      'sample_count', COALESCE(v_sample, 0),
      'cohort_gated', true
    );
  END IF;

  RETURN v_result || jsonb_build_object('cohort_gated', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.brain_infer_compliance(p_document_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, filla_brain
AS $$
DECLARE
  v_result JSONB;
  v_sample INT;
  v_min INT := public.brain_min_cohort();
BEGIN
  SELECT
    bcp.sample_count,
    jsonb_build_object(
      'recommended_frequency', bcp.recommended_frequency,
      'risk_level', bcp.risk_level,
      'probability_of_incident', COALESCE(bcp.probability_of_incident, 0.05),
      'sample_count', bcp.sample_count
    )
  INTO v_sample, v_result
  FROM filla_brain.brain_compliance_patterns bcp
  WHERE bcp.document_type = p_document_type
  ORDER BY bcp.sample_count DESC
  LIMIT 1;

  IF v_sample IS NULL OR v_sample < v_min THEN
    RETURN jsonb_build_object(
      'risk_level', 'low',
      'sample_count', COALESCE(v_sample, 0),
      'cohort_gated', true
    );
  END IF;

  RETURN v_result || jsonb_build_object('cohort_gated', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.brain_min_cohort() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.brain_infer_asset(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.brain_infer_compliance(TEXT) TO service_role;
