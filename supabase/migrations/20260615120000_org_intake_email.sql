-- Phase 1 external intake: org forward-to-Filla email address + email intake RPC.

-- Ensure org_settings exists (remote may have migration history without the table).
CREATE TABLE IF NOT EXISTS org_settings (
  org_id UUID PRIMARY KEY REFERENCES organisations(id) ON DELETE CASCADE,
  auto_schedule_compliance BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE org_settings
  ADD COLUMN IF NOT EXISTS auto_task_creation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_assignment BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS automation_aggressiveness TEXT DEFAULT 'recommended',
  ADD COLUMN IF NOT EXISTS automation_mode TEXT DEFAULT 'recommended',
  ADD COLUMN IF NOT EXISTS auto_task_generation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_task_levels TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_assign_contractors BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_assign_confidence NUMERIC DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS auto_expiry_update BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_expiry_confidence NUMERIC DEFAULT 0.85,
  ADD COLUMN IF NOT EXISTS auto_link_assets BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_link_asset_confidence NUMERIC DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS auto_link_spaces BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_link_space_confidence NUMERIC DEFAULT 0.70,
  ADD COLUMN IF NOT EXISTS automated_intelligence TEXT DEFAULT 'suggestions_only',
  ADD COLUMN IF NOT EXISTS prediction_aggressiveness TEXT DEFAULT 'recommended',
  ADD COLUMN IF NOT EXISTS hazard_sensitivity TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS data_sharing_level TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS ai_icon_suggestions BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_icon_override BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_icon_mode TEXT DEFAULT 'recommended',
  ADD COLUMN IF NOT EXISTS ai_icon_prefer TEXT DEFAULT 'global',
  ADD COLUMN IF NOT EXISTS ai_icon_fallback TEXT DEFAULT 'wrench',
  ADD COLUMN IF NOT EXISTS intake_email_token TEXT;

DROP POLICY IF EXISTS "org_settings_select" ON org_settings;
DROP POLICY IF EXISTS "org_settings_insert" ON org_settings;
DROP POLICY IF EXISTS "org_settings_update" ON org_settings;

CREATE POLICY "org_settings_select" ON org_settings FOR SELECT
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "org_settings_insert" ON org_settings FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));
CREATE POLICY "org_settings_update" ON org_settings FOR UPDATE
  USING (org_id IN (SELECT org_id FROM organisation_members WHERE user_id = auth.uid()));

UPDATE org_settings
SET intake_email_token = encode(gen_random_bytes(8), 'hex')
WHERE intake_email_token IS NULL;

ALTER TABLE org_settings
  ALTER COLUMN intake_email_token SET DEFAULT encode(gen_random_bytes(8), 'hex');

-- Backfill org_settings rows for orgs missing settings
INSERT INTO org_settings (org_id, intake_email_token)
SELECT o.id, encode(gen_random_bytes(8), 'hex')
FROM organisations o
WHERE NOT EXISTS (
  SELECT 1 FROM org_settings os WHERE os.org_id = o.id
);

UPDATE org_settings
SET intake_email_token = encode(gen_random_bytes(8), 'hex')
WHERE intake_email_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS org_settings_intake_email_token_key
  ON org_settings (intake_email_token);

ALTER TABLE intake_items
  ADD COLUMN IF NOT EXISTS raw_text TEXT;

-- Resolve org by intake email token (service role / edge functions)
CREATE OR REPLACE FUNCTION resolve_org_by_intake_email_token(p_token TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM org_settings
  WHERE intake_email_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION resolve_org_by_intake_email_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_org_by_intake_email_token(TEXT) TO service_role;

-- Match org member by sender email (inbound email routing)
CREATE OR REPLACE FUNCTION match_org_member_by_email(p_org_id UUID, p_email TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.user_id
  FROM organisation_members om
  INNER JOIN auth.users u ON u.id = om.user_id
  WHERE om.org_id = p_org_id
    AND lower(u.email) = lower(trim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION match_org_member_by_email(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_org_member_by_email(UUID, TEXT) TO service_role;

-- Display address for org members
CREATE OR REPLACE FUNCTION get_org_intake_email(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_slug TEXT;
  v_domain TEXT := coalesce(current_setting('app.intake_email_domain', true), 'inbox.filla.app');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this organisation';
  END IF;

  SELECT intake_email_token INTO v_token
  FROM org_settings
  WHERE org_id = p_org_id;

  IF v_token IS NULL THEN
    INSERT INTO org_settings (org_id, intake_email_token)
    VALUES (p_org_id, encode(gen_random_bytes(8), 'hex'))
    ON CONFLICT (org_id) DO UPDATE
    SET intake_email_token = COALESCE(org_settings.intake_email_token, encode(gen_random_bytes(8), 'hex'))
    RETURNING intake_email_token INTO v_token;
  END IF;

  SELECT lower(regexp_replace(substring(o.name FROM 1 FOR 24), '[^a-zA-Z0-9]', '', 'g'))
  INTO v_slug
  FROM organisations o
  WHERE o.id = p_org_id;

  IF v_slug IS NULL OR length(v_slug) < 2 THEN
    v_slug := substring(replace(p_org_id::text, '-', '') FROM 1 FOR 8);
  END IF;

  RETURN v_slug || '+' || v_token || '@' || v_domain;
END;
$$;

REVOKE ALL ON FUNCTION get_org_intake_email(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_org_intake_email(UUID) TO authenticated;

-- Service-role intake item creation from forwarded email
CREATE OR REPLACE FUNCTION create_intake_item_from_email(
  p_org_id UUID,
  p_created_by UUID,
  p_storage_path TEXT DEFAULT NULL,
  p_file_name TEXT DEFAULT NULL,
  p_mime_type TEXT DEFAULT NULL,
  p_file_size BIGINT DEFAULT NULL,
  p_raw_text TEXT DEFAULT NULL,
  p_id UUID DEFAULT NULL
)
RETURNS intake_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row intake_items;
BEGIN
  IF p_org_id IS NULL OR p_created_by IS NULL THEN
    RAISE EXCEPTION 'org_id and created_by are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = p_org_id AND user_id = p_created_by
  ) THEN
    RAISE EXCEPTION 'created_by is not a member of org';
  END IF;

  IF p_storage_path IS NOT NULL THEN
    IF split_part(p_storage_path, '/', 1) <> 'orgs'
       OR split_part(p_storage_path, '/', 3) <> 'inbox'
       OR split_part(p_storage_path, '/', 2)::uuid <> p_org_id THEN
      RAISE EXCEPTION 'Invalid inbox storage path for org';
    END IF;
  END IF;

  INSERT INTO intake_items (
    id,
    org_id,
    created_by,
    source_type,
    status,
    storage_path,
    file_name,
    mime_type,
    file_size,
    raw_text
  )
  VALUES (
    COALESCE(p_id, gen_random_uuid()),
    p_org_id,
    p_created_by,
    'forwarded_email',
    'pending',
    p_storage_path,
    p_file_name,
    NULLIF(p_mime_type, ''),
    p_file_size,
    NULLIF(left(p_raw_text, 4000), '')
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION create_intake_item_from_email(UUID, UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_intake_item_from_email(UUID, UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, UUID) TO service_role;

-- External email signal template
DO $$ BEGIN
  CREATE TYPE signal_severity AS ENUM ('info', 'warning', 'urgent', 'critical');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS signal_recommendation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtype TEXT NOT NULL UNIQUE,
  action_type TEXT NOT NULL CHECK (action_type IN ('create_task', 'create_record', 'alert', 'review')),
  template_key TEXT NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT,
  task_priority TEXT DEFAULT 'normal',
  checklist_template_key TEXT,
  default_severity signal_severity NOT NULL DEFAULT 'warning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO signal_recommendation_templates (
  subtype, action_type, template_key, title_template, body_template, default_severity, task_priority
)
VALUES (
  'ingestion.external_email',
  'alert',
  'external_email',
  'External email received',
  'Review forwarded content from an unknown sender and classify it.',
  'info',
  'normal'
)
ON CONFLICT (subtype) DO NOTHING;
