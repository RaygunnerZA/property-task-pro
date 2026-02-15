-- Phase 11B: brain_train RPC — ML aggregation for federated learning
-- Trains hazard co-occurrence, document expiry drift, asset failure probability curves.
-- Called nightly by brain-train edge function after extractor runs.

-- ============================================================================
-- brain_train() — aggregate patterns and store learned weights
-- ============================================================================
CREATE OR REPLACE FUNCTION public.brain_train()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, filla_brain
AS $$
DECLARE
  v_asset_updated INT;
  v_compliance_updated INT;
  v_hazard_updated INT;
BEGIN
  -- A. Train asset failure probability curves
  -- Heuristic: condition bucket + age bucket → failure_prob, mean_time_to_failure_days
  WITH params AS (
    SELECT
      bap.id,
      LEAST(0.95,
        CASE (bap.asset_vector->>'condition_bucket')
          WHEN '0-30' THEN 0.22
          WHEN '30-60' THEN 0.14
          WHEN '60-80' THEN 0.08
          WHEN '80-100' THEN 0.04
          ELSE 0.10
        END *
        CASE (bap.asset_vector->>'age_bucket')
          WHEN '0-2' THEN 0.8
          WHEN '2-5' THEN 0.9
          WHEN '5-10' THEN 1.0
          WHEN '10-15' THEN 1.2
          WHEN '15+' THEN 1.4
          ELSE 1.0
        END
      ) AS fp,
      GREATEST(30, (400.0 / NULLIF(
        CASE (bap.asset_vector->>'condition_bucket')
          WHEN '0-30' THEN 0.22
          WHEN '30-60' THEN 0.14
          WHEN '60-80' THEN 0.08
          WHEN '80-100' THEN 0.04
          ELSE 0.10
        END *
        CASE (bap.asset_vector->>'age_bucket')
          WHEN '0-2' THEN 0.8
          WHEN '2-5' THEN 0.9
          WHEN '5-10' THEN 1.0
          WHEN '10-15' THEN 1.2
          WHEN '15+' THEN 1.4
          ELSE 1.0
        END, 0))::INT) AS mttf
    FROM brain_asset_patterns bap
    WHERE bap.asset_vector IS NOT NULL
  )
  UPDATE brain_asset_patterns bap
  SET failure_probability = p.fp, mean_time_to_failure_days = p.mttf, updated_at = now()
  FROM params p
  WHERE bap.id = p.id;

  GET DIAGNOSTICS v_asset_updated = ROW_COUNT;

  -- B. Document expiry drift — store aggregated drift per document_type in brain_prediction_parameters
  INSERT INTO brain_prediction_parameters (model_name, parameters, version, created_at)
  SELECT
    'expiry_drift_' || document_type,
    jsonb_build_object('avg_drift_days', AVG(expiry_drift_days), 'sample_count', SUM(COALESCE(sample_count, 1))),
    to_char(now(), 'YYYYMMDD'),
    now()
  FROM brain_compliance_patterns
  WHERE document_type IS NOT NULL
  GROUP BY document_type
  ON CONFLICT (model_name) DO UPDATE SET parameters = EXCLUDED.parameters, version = EXCLUDED.version;

  GET DIAGNOSTICS v_compliance_updated = ROW_COUNT;

  -- C. Hazard co-occurrence — from compliance hazard_profile arrays
  WITH hazard_pairs AS (
    SELECT
      a.elem::TEXT AS h1,
      b.elem::TEXT AS h2
    FROM brain_compliance_patterns cp,
      LATERAL jsonb_array_elements_text(COALESCE(cp.hazard_profile->'hazards', '[]'::jsonb)) WITH ORDINALITY AS a(elem, ord),
      LATERAL jsonb_array_elements_text(COALESCE(cp.hazard_profile->'hazards', '[]'::jsonb)) WITH ORDINALITY AS b(elem, ord)
    WHERE jsonb_array_length(COALESCE(cp.hazard_profile->'hazards', '[]'::jsonb)) >= 2
      AND a.ord < b.ord
  ),
  co_occur AS (
    SELECT h1, h2, COUNT(*) AS cnt
    FROM hazard_pairs
    GROUP BY h1, h2
  )
  UPDATE brain_hazard_signals hs
  SET co_occurrence_patterns = COALESCE(
    (SELECT jsonb_agg(jsonb_build_object('hazard', co.h2, 'count', co.cnt))
     FROM co_occur co WHERE co.h1 = hs.hazard_type),
    '[]'::jsonb
  ),
  updated_at = now()
  WHERE hs.hazard_type IN (SELECT h1 FROM co_occur);

  GET DIAGNOSTICS v_hazard_updated = ROW_COUNT;

  INSERT INTO brain_learning_log (event_type, table_name, record_count, metadata, created_at)
  VALUES ('train', 'brain_train', v_asset_updated + v_compliance_updated + v_hazard_updated,
    jsonb_build_object('assets', v_asset_updated, 'compliance', v_compliance_updated, 'hazards', v_hazard_updated),
    now());

  RETURN jsonb_build_object(
    'ok', true,
    'assets_updated', v_asset_updated,
    'compliance_updated', v_compliance_updated,
    'hazards_updated', v_hazard_updated
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.brain_train() TO service_role;
