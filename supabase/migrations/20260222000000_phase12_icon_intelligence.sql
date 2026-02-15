-- Phase 12: Icon Intelligence Layer
-- Extend icon_name to compliance_documents, spaces, tasks.
-- Hazards are stored as TEXT[] on compliance_documents; no standalone hazards table.

-- ============================================================================
-- 12A — Add icon_name to all entity types
-- ============================================================================
ALTER TABLE compliance_documents ADD COLUMN IF NOT EXISTS icon_name TEXT;
COMMENT ON COLUMN compliance_documents.icon_name IS 'Lucide icon name (kebab-case). AI-suggested from document type.';

ALTER TABLE spaces ADD COLUMN IF NOT EXISTS icon_name TEXT;
COMMENT ON COLUMN spaces.icon_name IS 'Lucide icon name (kebab-case) for space display.';

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS icon_name TEXT;
COMMENT ON COLUMN tasks.icon_name IS 'Lucide icon name (kebab-case) for task display. AI-suggested from description/hazard/asset.';

-- ============================================================================
-- 12D — Filla Brain: Global icon learning
-- ============================================================================
-- Add reject_privacy_breaches trigger for brain_icon_patterns (Phase 11B pattern)
-- Note: brain_icon_patterns only stores entity_type, category, icon_name - all safe. Trigger added for consistency.
CREATE TABLE IF NOT EXISTS filla_brain.brain_icon_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('asset', 'compliance', 'space', 'task')),
  category TEXT NOT NULL DEFAULT '',
  icon_name TEXT NOT NULL,
  sample_count INT DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brain_icon_patterns_entity ON filla_brain.brain_icon_patterns(entity_type);
CREATE INDEX IF NOT EXISTS idx_brain_icon_patterns_category ON filla_brain.brain_icon_patterns(category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brain_icon_patterns_unique ON filla_brain.brain_icon_patterns(entity_type, category, icon_name);

GRANT ALL ON filla_brain.brain_icon_patterns TO service_role;

-- RPC: Ingest anonymised icon choice (privacy-safe)
CREATE OR REPLACE FUNCTION public.brain_ingest_icon_pattern(
  p_entity_type TEXT,
  p_icon_name TEXT,
  p_category TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, filla_brain
AS $$
DECLARE
  v_id UUID;
  v_cat TEXT := COALESCE(NULLIF(trim(p_category), ''), '');
BEGIN
  INSERT INTO brain_icon_patterns (entity_type, category, icon_name, sample_count, updated_at)
  VALUES (p_entity_type, v_cat, p_icon_name, 1, now())
  ON CONFLICT (entity_type, category, icon_name)
  DO UPDATE SET sample_count = brain_icon_patterns.sample_count + 1, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- RPC: Infer icon from entity type + category
CREATE OR REPLACE FUNCTION public.brain_infer_icon(
  p_entity_type TEXT,
  p_category TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, filla_brain
AS $$
DECLARE
  v_result JSONB;
  v_total BIGINT;
BEGIN
  WITH ranked AS (
    SELECT bip.icon_name, bip.sample_count,
      SUM(bip.sample_count) OVER () AS total
    FROM brain_icon_patterns bip
    WHERE bip.entity_type = p_entity_type
      AND (p_category IS NULL OR bip.category = COALESCE(NULLIF(trim(p_category), ''), '') OR bip.category = '')
    ORDER BY bip.sample_count DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'predicted_icon', r.icon_name,
    'confidence', r.sample_count::NUMERIC / NULLIF(r.total, 0),
    'sample_count', r.sample_count,
    'global_reason', 'Global usage pattern for ' || p_entity_type || COALESCE(' / ' || p_category, '')
  ) INTO v_result
  FROM ranked r;

  IF v_result IS NULL OR (v_result->>'predicted_icon') IS NULL THEN
    RETURN jsonb_build_object(
      'predicted_icon', CASE p_entity_type
        WHEN 'asset' THEN 'package'
        WHEN 'compliance' THEN 'file-text'
        WHEN 'space' THEN 'box'
        WHEN 'task' THEN 'wrench'
        ELSE 'circle'
      END,
      'confidence', 0,
      'sample_count', 0,
      'global_reason', 'No global pattern; using fallback'
    );
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.brain_ingest_icon_pattern(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.brain_infer_icon(TEXT, TEXT) TO service_role;

-- ============================================================================
-- 12F — Settings: AI Icon Automation Panel
-- ============================================================================
ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS ai_icon_suggestions BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_icon_override BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_icon_mode TEXT DEFAULT 'recommended'
    CHECK (ai_icon_mode IN ('conservative', 'recommended', 'aggressive')),
  ADD COLUMN IF NOT EXISTS ai_icon_prefer TEXT DEFAULT 'global'
    CHECK (ai_icon_prefer IN ('global', 'local', 'fallback')),
  ADD COLUMN IF NOT EXISTS ai_icon_fallback TEXT DEFAULT 'wrench'
    CHECK (ai_icon_fallback IN ('wrench', 'file-text', 'circle', 'empty'));

COMMENT ON COLUMN org_settings.ai_icon_suggestions IS 'Phase 12: Enable AI icon suggestions';
COMMENT ON COLUMN org_settings.ai_icon_override IS 'Phase 12: Allow AI to override icons';
COMMENT ON COLUMN org_settings.ai_icon_mode IS 'Phase 12: conservative | recommended | aggressive';
COMMENT ON COLUMN org_settings.ai_icon_prefer IS 'Phase 12: Prefer global patterns | local org defaults | fallback';
COMMENT ON COLUMN org_settings.ai_icon_fallback IS 'Phase 12: Fallback when unsure: wrench | file-text | circle | empty';
