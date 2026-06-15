-- User-initiated intake queue (uploads, picked files, calendar events).
-- Signals remain for system-detected events; intake_items are short-lived review items.

DO $$ BEGIN
  CREATE TYPE intake_source_type AS ENUM (
    'upload',
    'forwarded_email',
    'calendar_event',
    'cloud_file'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE intake_item_status AS ENUM (
    'pending',
    'processing',
    'ready',
    'confirmed',
    'ignored',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS intake_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  source_type intake_source_type NOT NULL DEFAULT 'upload',
  status intake_item_status NOT NULL DEFAULT 'pending',
  storage_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  file_size BIGINT,
  ai_classification TEXT,
  ai_extracted JSONB,
  ai_confidence NUMERIC,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_intake_items_org_created_at
  ON intake_items (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intake_items_created_by_status
  ON intake_items (created_by, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intake_items_org_status
  ON intake_items (org_id, status, created_at DESC);

ALTER TABLE intake_items ENABLE ROW LEVEL SECURITY;

-- Members can insert for their org
DROP POLICY IF EXISTS "intake_items_insert" ON intake_items;
CREATE POLICY "intake_items_insert" ON intake_items
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

-- Own rows + org owners/managers see all org rows
DROP POLICY IF EXISTS "intake_items_select" ON intake_items;
CREATE POLICY "intake_items_select" ON intake_items
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organisation_members om
        WHERE om.org_id = intake_items.org_id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'manager')
      )
    )
  );

-- Users may update their own non-terminal rows (status transitions via RPC preferred)
DROP POLICY IF EXISTS "intake_items_update_own" ON intake_items;
CREATE POLICY "intake_items_update_own" ON intake_items
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND status NOT IN ('confirmed', 'ignored', 'failed')
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

-- Create intake item from inbox upload (replaces compliance_sources for user uploads)
CREATE OR REPLACE FUNCTION create_intake_item_from_upload(
  p_id UUID,
  p_storage_path TEXT,
  p_file_name TEXT,
  p_mime_type TEXT,
  p_file_size BIGINT
)
RETURNS intake_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_row intake_items;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_storage_path IS NULL
     OR split_part(p_storage_path, '/', 1) <> 'orgs'
     OR split_part(p_storage_path, '/', 3) <> 'inbox'
     OR split_part(p_storage_path, '/', 4) = '' THEN
    RAISE EXCEPTION 'Invalid inbox storage path';
  END IF;

  IF split_part(p_storage_path, '/', 2) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid org segment in storage path';
  END IF;

  v_org_id := split_part(p_storage_path, '/', 2)::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No organisation membership for storage path org';
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
    file_size
  )
  VALUES (
    COALESCE(p_id, gen_random_uuid()),
    v_org_id,
    auth.uid(),
    'upload',
    'pending',
    p_storage_path,
    p_file_name,
    NULLIF(p_mime_type, ''),
    p_file_size
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION create_intake_item_from_upload(UUID, TEXT, TEXT, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_intake_item_from_upload(UUID, TEXT, TEXT, TEXT, BIGINT) TO authenticated;

-- Terminal status transitions (confirmed / ignored)
CREATE OR REPLACE FUNCTION update_intake_item_status(
  p_intake_item_id UUID,
  p_status intake_item_status
)
RETURNS intake_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row intake_items;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status NOT IN ('confirmed', 'ignored') THEN
    RAISE EXCEPTION 'Only confirmed or ignored status allowed from client';
  END IF;

  SELECT * INTO v_row
  FROM intake_items
  WHERE id = p_intake_item_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Intake item not found';
  END IF;

  IF v_row.created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Only the creator may update this intake item';
  END IF;

  IF v_row.status NOT IN ('ready', 'failed') THEN
    RAISE EXCEPTION 'Intake item is not in a reviewable state';
  END IF;

  UPDATE intake_items
  SET status = p_status
  WHERE id = p_intake_item_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION update_intake_item_status(UUID, intake_item_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_intake_item_status(UUID, intake_item_status) TO authenticated;
