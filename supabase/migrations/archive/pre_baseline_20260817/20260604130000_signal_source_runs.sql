-- Signal source run log + source_key on signals
-- Lean governance: observable without over-engineering.
-- Does NOT add configuration tables — thresholds stay as code constants.
-- See @Docs/Signal_Governance.md for the full policy.

-- ============================================================================
-- source_key on signals (governance bucket: weather, air_quality, pollen,
-- address_validation, property_geo_enrich, gps_evidence, compliance_auto)
-- ============================================================================
ALTER TABLE signals ADD COLUMN IF NOT EXISTS source_key TEXT;

CREATE INDEX IF NOT EXISTS signals_source_key
  ON signals (source_key)
  WHERE source_key IS NOT NULL;

-- ============================================================================
-- signal_source_runs — one row per scanner invocation
-- ============================================================================
CREATE TABLE IF NOT EXISTS signal_source_runs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key     TEXT        NOT NULL,
  org_id         UUID        REFERENCES organisations(id) ON DELETE SET NULL,
  run_type       TEXT        NOT NULL DEFAULT 'manual'
                             CHECK (run_type IN ('scheduled', 'manual', 'event')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ,
  status         TEXT        NOT NULL DEFAULT 'running'
                             CHECK (status IN ('running', 'success', 'partial', 'failed', 'skipped')),
  orgs_scanned   INTEGER     NOT NULL DEFAULT 0,
  properties_scanned INTEGER NOT NULL DEFAULT 0,
  skipped        INTEGER     NOT NULL DEFAULT 0,
  api_calls      INTEGER     NOT NULL DEFAULT 0,
  signals_created INTEGER    NOT NULL DEFAULT 0,
  duplicates_ignored INTEGER NOT NULL DEFAULT 0,
  expired_cleared INTEGER    NOT NULL DEFAULT 0,
  errors         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  metadata       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signal_source_runs_source_started
  ON signal_source_runs (source_key, started_at DESC);

CREATE INDEX IF NOT EXISTS signal_source_runs_org_started
  ON signal_source_runs (org_id, started_at DESC)
  WHERE org_id IS NOT NULL;

ALTER TABLE signal_source_runs ENABLE ROW LEVEL SECURITY;

-- Org managers can read their own runs; service role writes
DROP POLICY IF EXISTS "signal_source_runs_select" ON signal_source_runs;
CREATE POLICY "signal_source_runs_select" ON signal_source_runs
  FOR SELECT
  USING (
    org_id IS NULL -- global runs visible to all managers
    OR org_id = current_org_id()
  );

GRANT SELECT ON signal_source_runs TO authenticated;
GRANT ALL ON signal_source_runs TO service_role;

-- ============================================================================
-- Extend emit_signal to accept + store source_key
-- (backward-compatible: p_source_key defaults to NULL)
-- ============================================================================
CREATE OR REPLACE FUNCTION emit_signal(
  p_org_id        UUID,
  p_subtype       TEXT,
  p_title         TEXT,
  p_body          TEXT          DEFAULT NULL,
  p_kind          TEXT          DEFAULT 'system',
  p_category      TEXT          DEFAULT 'operational',
  p_severity      TEXT          DEFAULT 'info',
  p_property_id   UUID          DEFAULT NULL,
  p_space_id      UUID          DEFAULT NULL,
  p_asset_id      UUID          DEFAULT NULL,
  p_source        TEXT          DEFAULT 'system',
  p_source_key    TEXT          DEFAULT NULL,
  p_payload       JSONB         DEFAULT '{}'::jsonb,
  p_recommendation JSONB        DEFAULT NULL,
  p_dedupe_key    TEXT          DEFAULT NULL,
  p_expires_at    TIMESTAMPTZ   DEFAULT NULL,
  p_disposition   TEXT          DEFAULT 'recent',
  p_review_state  TEXT          DEFAULT 'none'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id       UUID;
  v_rec      JSONB;
  v_severity TEXT;
BEGIN
  IF p_dedupe_key IS NOT NULL THEN
    SELECT id INTO v_id
    FROM signals
    WHERE org_id = p_org_id
      AND dedupe_key = p_dedupe_key
      AND resolved_at IS NULL
      AND disposition NOT IN ('dismissed')
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  IF p_recommendation IS NULL THEN
    SELECT jsonb_build_object(
      'action', action_type,
      'template_key', template_key,
      'title', title_template,
      'body', body_template,
      'task_priority', task_priority
    ), default_severity::text
    INTO v_rec, v_severity
    FROM signal_recommendation_templates
    WHERE subtype = p_subtype;
  ELSE
    v_rec      := p_recommendation;
    v_severity := p_severity;
  END IF;

  INSERT INTO signals (
    org_id, property_id, space_id, asset_id,
    kind, category, subtype, severity,
    title, body, review_state, disposition,
    source, source_key, payload, recommendation, dedupe_key, expires_at
  )
  VALUES (
    p_org_id,
    p_property_id,
    p_space_id,
    p_asset_id,
    p_kind,
    p_category::signal_category,
    p_subtype,
    COALESCE(v_severity, p_severity)::signal_severity,
    p_title,
    p_body,
    p_review_state::signal_review_state,
    p_disposition::signal_disposition,
    p_source,
    p_source_key,
    p_payload,
    v_rec,
    p_dedupe_key,
    p_expires_at
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION emit_signal TO service_role;
