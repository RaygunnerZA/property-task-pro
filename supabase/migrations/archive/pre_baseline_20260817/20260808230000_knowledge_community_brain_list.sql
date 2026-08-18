-- List Filla Brain patterns eligible for Community Knowledge candidates (cohort-gated).

CREATE OR REPLACE FUNCTION public.list_brain_patterns_for_community(p_limit INT DEFAULT 20)
RETURNS TABLE (
  pattern_kind TEXT,
  document_type TEXT,
  asset_vector JSONB,
  recommended_frequency TEXT,
  risk_level TEXT,
  failure_probability NUMERIC,
  mean_time_to_failure_days INT,
  sample_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, filla_brain
AS $$
DECLARE
  v_min INT := public.brain_min_cohort();
  v_lim INT := GREATEST(COALESCE(p_limit, 20), 1);
BEGIN
  RETURN QUERY
  SELECT
    x.pattern_kind,
    x.document_type,
    x.asset_vector,
    x.recommended_frequency,
    x.risk_level,
    x.failure_probability,
    x.mean_time_to_failure_days,
    x.sample_count
  FROM (
    SELECT
      'compliance'::TEXT AS pattern_kind,
      bcp.document_type,
      NULL::JSONB AS asset_vector,
      bcp.recommended_frequency,
      bcp.risk_level,
      NULL::NUMERIC AS failure_probability,
      NULL::INT AS mean_time_to_failure_days,
      bcp.sample_count
    FROM filla_brain.brain_compliance_patterns bcp
    WHERE bcp.sample_count >= v_min
    ORDER BY bcp.sample_count DESC
    LIMIT v_lim
  ) x;

  RETURN QUERY
  SELECT
    y.pattern_kind,
    y.document_type,
    y.asset_vector,
    y.recommended_frequency,
    y.risk_level,
    y.failure_probability,
    y.mean_time_to_failure_days,
    y.sample_count
  FROM (
    SELECT
      'asset'::TEXT AS pattern_kind,
      NULL::TEXT AS document_type,
      bap.asset_vector,
      NULL::TEXT AS recommended_frequency,
      NULL::TEXT AS risk_level,
      bap.failure_probability,
      bap.mean_time_to_failure_days,
      bap.sample_count
    FROM filla_brain.brain_asset_patterns bap
    WHERE bap.sample_count >= v_min
    ORDER BY bap.sample_count DESC
    LIMIT v_lim
  ) y;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_brain_patterns_for_community(INT) TO service_role;
