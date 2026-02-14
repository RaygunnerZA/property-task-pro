-- Phase 11: Filla Federated Brain — Global Intelligence Layer
-- Cross-org learning without leaking org data. Full privacy preservation.
-- Schema: filla_brain (separate from RLS-enforced org schemas)
-- Contains only anonymised, aggregated parameters — never org IDs or identifiable data.

CREATE SCHEMA IF NOT EXISTS filla_brain;

-- ============================================================================
-- 1. brain_asset_patterns
-- Aggregated asset behaviour patterns
-- ============================================================================
CREATE TABLE IF NOT EXISTS filla_brain.brain_asset_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_vector JSONB NOT NULL,
  failure_probability NUMERIC,
  mean_time_to_failure_days INT,
  hazard_correlation JSONB DEFAULT '{}',
  sample_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_asset_patterns_vector ON filla_brain.brain_asset_patterns USING GIN (asset_vector);
CREATE INDEX IF NOT EXISTS idx_brain_asset_patterns_updated ON filla_brain.brain_asset_patterns(updated_at);

-- ============================================================================
-- 2. brain_compliance_patterns
-- Learned patterns about compliance drift
-- ============================================================================
CREATE TABLE IF NOT EXISTS filla_brain.brain_compliance_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  hazard_profile JSONB DEFAULT '{}',
  expiry_drift_days INT,
  probability_of_incident NUMERIC,
  recommended_frequency TEXT,
  risk_level TEXT CHECK (risk_level IN ('low', 'high', 'critical')),
  sample_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_compliance_patterns_type ON filla_brain.brain_compliance_patterns(document_type);
CREATE INDEX IF NOT EXISTS idx_brain_compliance_patterns_risk ON filla_brain.brain_compliance_patterns(risk_level);

-- ============================================================================
-- 3. brain_hazard_signals
-- AI-observed hazard categories (never actual images)
-- ============================================================================
CREATE TABLE IF NOT EXISTS filla_brain.brain_hazard_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_type TEXT NOT NULL,
  co_occurrence_patterns JSONB DEFAULT '[]',
  risk_amplification_scores JSONB DEFAULT '{}',
  risk_factors JSONB DEFAULT '{}',
  sample_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_hazard_signals_type ON filla_brain.brain_hazard_signals(hazard_type);

-- ============================================================================
-- 4. brain_prediction_parameters
-- Global model weights for predictive maintenance
-- ============================================================================
CREATE TABLE IF NOT EXISTS filla_brain.brain_prediction_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  parameters JSONB NOT NULL DEFAULT '{}',
  version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brain_prediction_params_model ON filla_brain.brain_prediction_parameters(model_name);

-- ============================================================================
-- 5. brain_learning_log
-- Audit-safe logs of pattern training, no org references
-- ============================================================================
CREATE TABLE IF NOT EXISTS filla_brain.brain_learning_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  table_name TEXT,
  record_count INT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_learning_log_created ON filla_brain.brain_learning_log(created_at);

-- ============================================================================
-- 6. Grant access to service role (edge functions use service role)
-- ============================================================================
GRANT USAGE ON SCHEMA filla_brain TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA filla_brain TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA filla_brain TO service_role;

-- ============================================================================
-- 7. RPC functions for edge functions to write to filla_brain (no direct schema access)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.brain_ingest_asset_pattern(p_vector JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, filla_brain
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO filla_brain.brain_asset_patterns (asset_vector, sample_count, updated_at)
  VALUES (p_vector, 1, now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.brain_ingest_compliance_pattern(
  p_document_type TEXT,
  p_hazard_profile JSONB DEFAULT '{}',
  p_expiry_drift_days INT DEFAULT NULL,
  p_risk_level TEXT DEFAULT 'low'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, filla_brain
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO filla_brain.brain_compliance_patterns (document_type, hazard_profile, expiry_drift_days, risk_level, sample_count, updated_at)
  VALUES (p_document_type, p_hazard_profile, p_expiry_drift_days, p_risk_level, 1, now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.brain_ingest_hazard_signal(p_hazard_type TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, filla_brain
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO filla_brain.brain_hazard_signals (hazard_type, sample_count, updated_at)
  VALUES (p_hazard_type, 1, now())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.brain_ingest_learning_log(p_event_type TEXT, p_table_name TEXT, p_record_count INT, p_metadata JSONB DEFAULT '{}')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, filla_brain
AS $$
BEGIN
  INSERT INTO filla_brain.brain_learning_log (event_type, table_name, record_count, metadata, created_at)
  VALUES (p_event_type, p_table_name, p_record_count, p_metadata, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.brain_ingest_asset_pattern(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.brain_ingest_compliance_pattern(TEXT, JSONB, INT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.brain_ingest_hazard_signal(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.brain_ingest_learning_log(TEXT, TEXT, INT, JSONB) TO service_role;

-- ============================================================================
-- 9. RPC for inference (read-only, returns predictions from brain)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.brain_infer_asset(p_vector JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, filla_brain
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'failure_probability', COALESCE(AVG(bap.failure_probability), 0.1),
    'mean_time_to_failure_days', COALESCE((AVG(bap.mean_time_to_failure_days))::INT, 365),
    'hazard_correlation', COALESCE(MAX(bap.hazard_correlation), '{}'),
    'sample_count', COALESCE(SUM(bap.sample_count), 0)
  ) INTO v_result
  FROM filla_brain.brain_asset_patterns bap
  WHERE bap.asset_vector @> p_vector OR p_vector @> bap.asset_vector;
  RETURN COALESCE(v_result, '{"failure_probability": 0.1, "mean_time_to_failure_days": 365, "sample_count": 0}'::jsonb);
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
BEGIN
  SELECT jsonb_build_object(
    'recommended_frequency', bcp.recommended_frequency,
    'risk_level', bcp.risk_level,
    'probability_of_incident', COALESCE(bcp.probability_of_incident, 0.05),
    'sample_count', bcp.sample_count
  ) INTO v_result
  FROM filla_brain.brain_compliance_patterns bcp
  WHERE bcp.document_type = p_document_type
  ORDER BY bcp.sample_count DESC
  LIMIT 1;
  RETURN COALESCE(v_result, '{"risk_level": "low", "sample_count": 0}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.brain_infer_asset(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.brain_infer_compliance(TEXT) TO service_role;

-- ============================================================================
-- 8. Org settings: AI preferences (Phase 11)
-- ============================================================================
ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS automated_intelligence TEXT DEFAULT 'suggestions_only'
    CHECK (automated_intelligence IN ('off', 'suggestions_only', 'auto_draft', 'auto_create', 'full_automation')),
  ADD COLUMN IF NOT EXISTS prediction_aggressiveness TEXT DEFAULT 'recommended'
    CHECK (prediction_aggressiveness IN ('conservative', 'recommended', 'aggressive')),
  ADD COLUMN IF NOT EXISTS hazard_sensitivity TEXT DEFAULT 'medium'
    CHECK (hazard_sensitivity IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS data_sharing_level TEXT DEFAULT 'standard'
    CHECK (data_sharing_level IN ('minimal', 'standard', 'full_anonymised'));

COMMENT ON COLUMN org_settings.automated_intelligence IS 'Phase 11: Off | Suggestions only | Auto-draft | Auto-create | Full automation';
COMMENT ON COLUMN org_settings.data_sharing_level IS 'Phase 11: What anonymised signals to send to Filla Brain. Never shares private data.';
