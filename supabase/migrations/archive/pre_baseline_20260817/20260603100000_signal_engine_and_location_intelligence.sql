-- Signal Engine + Location Intelligence foundation (Environmental & Location Layer Phase 0)
-- Canon: @Docs/03_Data_Model.md, @Docs/19_Platform_Arch.md

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE signal_category AS ENUM (
    'environmental', 'location', 'property', 'compliance', 'operational'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE signal_severity AS ENUM ('info', 'warning', 'urgent', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE signal_disposition AS ENUM (
    'recent', 'needs_review', 'urgent', 'dismissed',
    'converted_to_issue', 'converted_to_record', 'snoozed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE signal_review_state AS ENUM (
    'none', 'needs_classification', 'needs_assignment',
    'needs_linking', 'needs_resolution', 'needs_permissions'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE geo_capture_context AS ENUM (
    'task_complete', 'inspection_complete', 'photo_upload',
    'asset_verify', 'compliance_record', 'site_visit'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PROPERTY LOCATION FIELDS
-- ============================================================================

ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS address_formatted TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS address_components JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS address_validated_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS geo_accuracy_m DOUBLE PRECISION;

-- ============================================================================
-- SIGNALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'system',
  category signal_category NOT NULL DEFAULT 'operational',
  subtype TEXT NOT NULL,
  severity signal_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  review_state signal_review_state NOT NULL DEFAULT 'none',
  disposition signal_disposition NOT NULL DEFAULT 'recent',
  source TEXT NOT NULL DEFAULT 'system',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation JSONB,
  dedupe_key TEXT,
  expires_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  converted_entity_type TEXT,
  converted_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS signals_org_dedupe_key_unique
  ON signals (org_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND resolved_at IS NULL AND disposition NOT IN ('dismissed');

CREATE INDEX IF NOT EXISTS signals_org_disposition_created
  ON signals (org_id, disposition, created_at DESC);

CREATE INDEX IF NOT EXISTS signals_org_property
  ON signals (org_id, property_id, created_at DESC)
  WHERE property_id IS NOT NULL;

ALTER TABLE signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "signals_select" ON signals;
CREATE POLICY "signals_select" ON signals
  FOR SELECT
  USING (
    org_id = current_org_id()
    AND (
      (auth.jwt() ->> 'role') != 'staff'
      OR property_id IS NULL
      OR property_id = ANY(assigned_properties())
    )
  );

DROP POLICY IF EXISTS "signals_update" ON signals;
CREATE POLICY "signals_update" ON signals
  FOR UPDATE
  USING (
    org_id = current_org_id()
    AND org_id IN (
      SELECT om.org_id FROM organisation_members om
      WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'manager')
    )
  );

-- ============================================================================
-- GEO CAPTURES (action-time GPS evidence)
-- ============================================================================

CREATE TABLE IF NOT EXISTS geo_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  attachment_id UUID,
  compliance_document_id UUID,
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  capture_context geo_capture_context NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS geo_captures_org_property
  ON geo_captures (org_id, property_id, captured_at DESC);

ALTER TABLE geo_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geo_captures_select" ON geo_captures;
CREATE POLICY "geo_captures_select" ON geo_captures
  FOR SELECT
  USING (org_id = current_org_id());

DROP POLICY IF EXISTS "geo_captures_insert" ON geo_captures;
CREATE POLICY "geo_captures_insert" ON geo_captures
  FOR INSERT
  WITH CHECK (
    org_id = current_org_id()
    AND user_id = auth.uid()
    AND org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- RECOMMENDATION TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS signal_recommendation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtype TEXT NOT NULL UNIQUE,
  action_type TEXT NOT NULL CHECK (action_type IN ('create_task', 'create_record', 'alert')),
  template_key TEXT NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT,
  task_priority TEXT DEFAULT 'normal',
  checklist_template_key TEXT,
  default_severity signal_severity NOT NULL DEFAULT 'warning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO signal_recommendation_templates (subtype, action_type, template_key, title_template, body_template, task_priority, default_severity)
VALUES
  ('weather.heavy_rain', 'create_task', 'drainage_inspection', 'Drainage inspection recommended', 'Heavy rain forecast — check drains and gutters.', 'normal', 'warning'),
  ('weather.storm', 'create_task', 'roof_inspection', 'Roof inspection recommended', 'Storm forecast — inspect roof and external fixtures.', 'high', 'urgent'),
  ('weather.freeze_risk', 'create_task', 'pipe_freeze_prevention', 'Pipe freeze prevention check', 'Sub-zero temperatures forecast — protect pipes and heating.', 'high', 'urgent'),
  ('weather.heatwave', 'create_task', 'hvac_maintenance', 'HVAC maintenance check', 'Heatwave forecast — verify cooling systems.', 'normal', 'warning'),
  ('weather.high_wind', 'create_task', 'external_asset_inspection', 'External asset inspection', 'High wind forecast — secure external assets.', 'normal', 'warning'),
  ('weather.snow', 'create_task', 'access_route_review', 'Access route review', 'Snow forecast — review access routes and gritting.', 'normal', 'warning'),
  ('weather.lightning', 'create_task', 'electrical_check', 'Electrical infrastructure check', 'Lightning risk — verify electrical safety.', 'high', 'urgent'),
  ('air_quality.poor', 'create_task', 'ventilation_review', 'Ventilation review recommended', 'Poor air quality — review ventilation and filters.', 'normal', 'warning'),
  ('air_quality.extended_event', 'alert', 'occupant_wellbeing', 'Extended poor air quality', 'Prolonged poor air quality — consider occupant wellbeing measures.', 'normal', 'urgent'),
  ('pollen.high', 'create_task', 'filter_replacement', 'Filter replacement recommended', 'High pollen levels — check HVAC filters.', 'normal', 'info'),
  ('property.geocode_failed', 'alert', 'fix_address', 'Property address could not be geocoded', 'Update the property address for environmental monitoring.', 'normal', 'warning'),
  ('property.missing_location_data', 'alert', 'add_location', 'Property missing location data', 'Add or validate the property address to enable environmental signals.', 'normal', 'info'),
  ('property.invalid_address', 'alert', 'validate_address', 'Invalid property address detected', 'Review and correct the property address.', 'normal', 'warning'),
  ('property.duplicate_detected', 'alert', 'review_duplicate', 'Possible duplicate property', 'A similar address may already exist in your portfolio.', 'normal', 'warning'),
  ('location.gps_verified', 'alert', 'gps_verified', 'GPS verified on-site', 'Work completed with verified on-site location.', 'normal', 'info'),
  ('location.off_site_completion', 'alert', 'off_site_review', 'Off-site completion flagged', 'Task marked complete away from the property — review recommended.', 'normal', 'warning'),
  ('location.photo_proximity', 'alert', 'photo_asset_suggest', 'Photo near asset', 'A photo was taken near an asset — link it for better records.', 'normal', 'info'),
  ('operational.nearby_overdue', 'create_task', 'nearby_overdue', 'Overdue work nearby', 'You are on site — overdue inspections or tasks are nearby.', 'high', 'urgent')
ON CONFLICT (subtype) DO NOTHING;

-- ============================================================================
-- EMIT SIGNAL (idempotent)
-- ============================================================================

CREATE OR REPLACE FUNCTION emit_signal(
  p_org_id UUID,
  p_subtype TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_kind TEXT DEFAULT 'system',
  p_category signal_category DEFAULT 'operational',
  p_severity signal_severity DEFAULT 'info',
  p_property_id UUID DEFAULT NULL,
  p_space_id UUID DEFAULT NULL,
  p_asset_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'system',
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_recommendation JSONB DEFAULT NULL,
  p_dedupe_key TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_disposition signal_disposition DEFAULT 'recent',
  p_review_state signal_review_state DEFAULT 'none'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_rec JSONB;
  v_severity signal_severity;
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
    ), default_severity
    INTO v_rec, v_severity
    FROM signal_recommendation_templates
    WHERE subtype = p_subtype;
  ELSE
    v_rec := p_recommendation;
    v_severity := p_severity;
  END IF;

  INSERT INTO signals (
    org_id, property_id, space_id, asset_id,
    kind, category, subtype, severity,
    title, body, review_state, disposition,
    source, payload, recommendation, dedupe_key, expires_at
  )
  VALUES (
    p_org_id, p_property_id, p_space_id, p_asset_id,
    p_kind, p_category, p_subtype, COALESCE(v_severity, p_severity),
    p_title, p_body, p_review_state, p_disposition,
    p_source, p_payload, v_rec, p_dedupe_key, p_expires_at
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION emit_signal TO service_role;

-- ============================================================================
-- RESOLVE / DISMISS / SNOOZE / CONVERT SIGNALS
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_signal(
  p_signal_id UUID,
  p_disposition signal_disposition DEFAULT 'dismissed'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE signals
  SET disposition = p_disposition,
      resolved_at = now(),
      updated_at = now()
  WHERE id = p_signal_id
    AND org_id = current_org_id()
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    );
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_signal TO authenticated;

CREATE OR REPLACE FUNCTION snooze_signal(
  p_signal_id UUID,
  p_until TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE signals
  SET disposition = 'snoozed',
      expires_at = p_until,
      updated_at = now()
  WHERE id = p_signal_id
    AND org_id = current_org_id()
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    );
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION snooze_signal TO authenticated;

CREATE OR REPLACE FUNCTION convert_signal_to_task(
  p_signal_id UUID,
  p_task_title TEXT DEFAULT NULL,
  p_task_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signal signals%ROWTYPE;
  v_task_id UUID;
  v_title TEXT;
  v_desc TEXT;
  v_priority TEXT;
BEGIN
  SELECT * INTO v_signal
  FROM signals
  WHERE id = p_signal_id AND org_id = current_org_id();

  IF v_signal.id IS NULL THEN
    RAISE EXCEPTION 'Signal not found';
  END IF;

  v_title := COALESCE(p_task_title, v_signal.title);
  v_desc := COALESCE(p_task_description, v_signal.body);
  v_priority := COALESCE(v_signal.recommendation->>'task_priority', 'normal');

  INSERT INTO tasks (org_id, property_id, title, description, status, priority)
  VALUES (v_signal.org_id, v_signal.property_id, v_title, v_desc, 'open', v_priority)
  RETURNING id INTO v_task_id;

  UPDATE signals
  SET disposition = 'converted_to_issue',
      resolved_at = now(),
      converted_entity_type = 'task',
      converted_entity_id = v_task_id,
      updated_at = now()
  WHERE id = p_signal_id;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_signal.org_id,
    auth.uid(),
    'signal',
    p_signal_id,
    'converted_to_task',
    jsonb_build_object('task_id', v_task_id, 'subtype', v_signal.subtype)
  );

  RETURN v_task_id;
END;
$$;

GRANT EXECUTE ON FUNCTION convert_signal_to_task TO authenticated;

-- ============================================================================
-- UPDATE PROPERTY GEO (service role + authenticated via RPC)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_property_geo(
  p_property_id UUID,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_place_id TEXT DEFAULT NULL,
  p_address_formatted TEXT DEFAULT NULL,
  p_address_components JSONB DEFAULT NULL,
  p_geo_accuracy_m DOUBLE PRECISION DEFAULT NULL,
  p_address_validated BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE properties
  SET
    latitude = COALESCE(p_latitude, latitude),
    longitude = COALESCE(p_longitude, longitude),
    place_id = COALESCE(p_place_id, place_id),
    address_formatted = COALESCE(p_address_formatted, address_formatted),
    address_components = COALESCE(p_address_components, address_components),
    geo_accuracy_m = COALESCE(p_geo_accuracy_m, geo_accuracy_m),
    geocoded_at = CASE WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN now() ELSE geocoded_at END,
    address_validated_at = CASE WHEN p_address_validated THEN now() ELSE address_validated_at END,
    updated_at = now()
  WHERE id = p_property_id
    AND org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    );
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION update_property_geo TO authenticated;
GRANT EXECUTE ON FUNCTION update_property_geo TO service_role;
