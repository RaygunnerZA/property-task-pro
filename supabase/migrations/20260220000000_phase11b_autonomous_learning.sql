-- Phase 11B: Autonomous Learning, Safety Enforcement, Global Benchmarking
-- Nightly cron, event triggers, brain-train, privacy rejection, benchmark percentile

-- ============================================================================
-- 1. Extensions (pg_cron, pg_net for scheduling)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- 2. brain_extract_pending — queue for event-triggered extraction
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.brain_extract_pending (
  org_id UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. Event triggers — queue org for extraction (no row data passed)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.brain_queue_extract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO brain_extract_pending (org_id) VALUES (COALESCE(NEW.org_id, OLD.org_id))
  ON CONFLICT (org_id) DO UPDATE SET created_at = now();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS brain_extract_on_assets ON assets;
CREATE TRIGGER brain_extract_on_assets
  AFTER INSERT OR UPDATE OF asset_type, condition_score, install_date, metadata
  ON assets
  FOR EACH ROW
  EXECUTE FUNCTION brain_queue_extract();

DROP TRIGGER IF EXISTS brain_extract_on_compliance ON compliance_documents;
CREATE TRIGGER brain_extract_on_compliance
  AFTER INSERT OR UPDATE OF document_type, hazards, expiry_date, next_due_date, status
  ON compliance_documents
  FOR EACH ROW
  EXECUTE FUNCTION brain_queue_extract();

DROP TRIGGER IF EXISTS brain_extract_on_image_analysis ON image_analysis_results;
CREATE TRIGGER brain_extract_on_image_analysis
  AFTER INSERT OR UPDATE OF detected_objects, metadata
  ON image_analysis_results
  FOR EACH ROW
  EXECUTE FUNCTION brain_queue_extract();

-- ============================================================================
-- 4. reject_privacy_breaches — Brain-layer rejection of forbidden data
-- ============================================================================
CREATE OR REPLACE FUNCTION filla_brain.reject_privacy_breaches()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_text TEXT;
  v_patterns TEXT[] := ARRAY[
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
    '@[a-z0-9.-]+\.[a-z]{2,}',
    'https?://',
    '(street|avenue|road|unit|flat|apt|block|drive|lane|way|place|court)'
  ];
  p TEXT;
BEGIN
  v_text := COALESCE(NEW::TEXT, '');
  IF TG_TABLE_NAME = 'brain_asset_patterns' AND NEW.asset_vector IS NOT NULL THEN
    v_text := v_text || NEW.asset_vector::TEXT;
  ELSIF TG_TABLE_NAME = 'brain_compliance_patterns' THEN
    v_text := v_text || COALESCE(NEW.hazard_profile::TEXT, '');
  ELSIF TG_TABLE_NAME = 'brain_hazard_signals' THEN
    v_text := v_text || COALESCE(NEW.risk_factors::TEXT, '') || COALESCE(NEW.co_occurrence_patterns::TEXT, '');
  END IF;

  v_text := LOWER(v_text);
  FOREACH p IN ARRAY v_patterns LOOP
    IF v_text ~* p THEN
      RAISE EXCEPTION 'filla_brain: privacy breach rejected (pattern: %)', p;
    END IF;
  END LOOP;

  IF length(v_text) > 10000 THEN
    RAISE EXCEPTION 'filla_brain: rejected - payload too large (possible free text)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_privacy_brain_asset_patterns ON filla_brain.brain_asset_patterns;
CREATE TRIGGER reject_privacy_brain_asset_patterns
  BEFORE INSERT OR UPDATE ON filla_brain.brain_asset_patterns
  FOR EACH ROW EXECUTE FUNCTION filla_brain.reject_privacy_breaches();

DROP TRIGGER IF EXISTS reject_privacy_brain_compliance_patterns ON filla_brain.brain_compliance_patterns;
CREATE TRIGGER reject_privacy_brain_compliance_patterns
  BEFORE INSERT OR UPDATE ON filla_brain.brain_compliance_patterns
  FOR EACH ROW EXECUTE FUNCTION filla_brain.reject_privacy_breaches();

DROP TRIGGER IF EXISTS reject_privacy_brain_hazard_signals ON filla_brain.brain_hazard_signals;
CREATE TRIGGER reject_privacy_brain_hazard_signals
  BEFORE INSERT OR UPDATE ON filla_brain.brain_hazard_signals
  FOR EACH ROW EXECUTE FUNCTION filla_brain.reject_privacy_breaches();

-- ============================================================================
-- 5. RPC: brain_compute_benchmark — percentile for asset type + age + condition
-- ============================================================================
CREATE OR REPLACE FUNCTION public.brain_compute_benchmark(p_asset_vector JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, filla_brain
AS $$
DECLARE
  v_at TEXT;
  v_cb TEXT;
  v_ab TEXT;
  v_fail_prob NUMERIC;
  v_mttf INT;
  v_percentile INT;
  v_global_mean_mttf NUMERIC;
  v_min_fp NUMERIC;
  v_max_fp NUMERIC;
  v_count BIGINT;
BEGIN
  v_at := p_asset_vector->>'asset_type';
  v_cb := p_asset_vector->>'condition_bucket';
  v_ab := p_asset_vector->>'age_bucket';

  SELECT
    AVG(failure_probability)::NUMERIC,
    AVG(mean_time_to_failure_days)::INT,
    MIN(failure_probability)::NUMERIC,
    MAX(failure_probability)::NUMERIC,
    COUNT(*)
  INTO v_fail_prob, v_mttf, v_min_fp, v_max_fp, v_count
  FROM brain_asset_patterns bap
  WHERE (v_at IS NULL OR (bap.asset_vector->>'asset_type') = v_at)
    AND (v_cb IS NULL OR (bap.asset_vector->>'condition_bucket') = v_cb)
    AND (v_ab IS NULL OR (bap.asset_vector->>'age_bucket') = v_ab);

  IF v_count = 0 THEN
    RETURN jsonb_build_object(
      'benchmark_percentile', 50,
      'global_mean_time_to_failure', 365,
      'global_failure_probability_range', '0.05 – 0.20',
      'sample_count', 0
    );
  END IF;

  SELECT COUNT(*) * 100.0 / NULLIF(v_count, 0) INTO v_percentile
  FROM brain_asset_patterns bap
  WHERE (v_at IS NULL OR (bap.asset_vector->>'asset_type') = v_at)
    AND (v_cb IS NULL OR (bap.asset_vector->>'condition_bucket') = v_cb)
    AND (v_ab IS NULL OR (bap.asset_vector->>'age_bucket') = v_ab)
    AND COALESCE(bap.failure_probability, 0.1) <= COALESCE(v_fail_prob, 0.1);

  RETURN jsonb_build_object(
    'benchmark_percentile', LEAST(100, GREATEST(0, COALESCE(v_percentile::INT, 50))),
    'global_mean_time_to_failure', COALESCE(v_mttf, 365),
    'global_failure_probability_range', COALESCE(v_min_fp::TEXT, '0.05') || ' – ' || COALESCE(v_max_fp::TEXT, '0.20'),
    'sample_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.brain_compute_benchmark(JSONB) TO service_role;

-- ============================================================================
-- 6. Cron jobs (require vault secrets: project_url, service_role_key)
-- Run: SELECT vault.create_secret('https://YOUR_PROJECT.supabase.co', 'project_url');
-- Run: SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
-- ============================================================================
DO $cron$
DECLARE
  jid BIGINT;
  cmd TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('brain-nightly-extract', 'brain-nightly-train', 'brain-process-extract-queue')
    LOOP
      PERFORM cron.unschedule(jid);
    END LOOP;

    cmd := 'SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''project_url'') || ''/functions/v1/local-to-global-extractor'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''service_role_key'')), body := ''{"mode": "all_orgs"}''::jsonb) AS request_id';
    PERFORM cron.schedule('brain-nightly-extract', '0 2 * * *', cmd);

    cmd := 'SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''project_url'') || ''/functions/v1/brain-train'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''service_role_key'')), body := ''{}''::jsonb) AS request_id';
    PERFORM cron.schedule('brain-nightly-train', '5 2 * * *', cmd);

    cmd := 'SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''project_url'') || ''/functions/v1/local-to-global-extractor'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''service_role_key'')), body := ''{"mode": "process_queue"}''::jsonb) AS request_id';
    PERFORM cron.schedule('brain-process-extract-queue', '*/15 * * * *', cmd);
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $cron$;
