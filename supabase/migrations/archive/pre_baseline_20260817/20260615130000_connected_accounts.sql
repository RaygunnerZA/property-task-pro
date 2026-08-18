-- Phase 2: connected_accounts shell (OAuth tokens stored at app layer; columns hold encrypted blobs later).

CREATE TYPE connected_account_provider AS ENUM ('google', 'microsoft', 'apple');

CREATE TYPE connected_account_status AS ENUM ('active', 'expired', 'revoked');

CREATE TABLE connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider connected_account_provider NOT NULL,
  provider_account_id TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status connected_account_status NOT NULL DEFAULT 'active',
  -- Token material encrypted at app layer before insert (see oauth-connect-callback edge fn).
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, provider, provider_account_id)
);

CREATE INDEX connected_accounts_org_id_idx ON connected_accounts (org_id);
CREATE INDEX connected_accounts_user_id_idx ON connected_accounts (user_id);

ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY connected_accounts_select_own
  ON connected_accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY connected_accounts_select_org_owner
  ON connected_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.org_id = connected_accounts.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'manager')
    )
  );

CREATE POLICY connected_accounts_insert_own
  ON connected_accounts FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organisation_members om
      WHERE om.org_id = connected_accounts.org_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY connected_accounts_update_own
  ON connected_accounts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY connected_accounts_delete_own
  ON connected_accounts FOR DELETE
  USING (user_id = auth.uid());

COMMENT ON TABLE connected_accounts IS
  'Phase 2 OAuth shell: per-user provider connections for calendar and cloud pickers.';

-- Phase 3: calendar event → intake_items (service role / edge functions)
CREATE OR REPLACE FUNCTION create_intake_item_from_calendar_event(
  p_org_id UUID,
  p_created_by UUID,
  p_raw_text TEXT,
  p_ai_extracted JSONB DEFAULT NULL,
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

  INSERT INTO intake_items (
    id,
    org_id,
    created_by,
    source_type,
    status,
    raw_text,
    ai_extracted,
    ai_classification,
    processed_at
  )
  VALUES (
    COALESCE(p_id, gen_random_uuid()),
    p_org_id,
    p_created_by,
    'calendar_event',
    'ready',
    NULLIF(left(p_raw_text, 4000), ''),
    p_ai_extracted,
    'Calendar event',
    now()
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION create_intake_item_from_calendar_event(UUID, UUID, TEXT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_intake_item_from_calendar_event(UUID, UUID, TEXT, JSONB, UUID) TO authenticated, service_role;

-- Phase 4: cloud file → intake_items (service role / edge functions)
CREATE OR REPLACE FUNCTION create_intake_item_from_cloud_file(
  p_org_id UUID,
  p_created_by UUID,
  p_storage_path TEXT,
  p_file_name TEXT,
  p_mime_type TEXT,
  p_file_size BIGINT,
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
  IF p_org_id IS NULL OR p_created_by IS NULL OR p_storage_path IS NULL THEN
    RAISE EXCEPTION 'org_id, created_by, and storage_path are required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = p_org_id AND user_id = p_created_by
  ) THEN
    RAISE EXCEPTION 'created_by is not a member of org';
  END IF;

  IF split_part(p_storage_path, '/', 1) <> 'orgs'
     OR split_part(p_storage_path, '/', 3) <> 'inbox'
     OR split_part(p_storage_path, '/', 2)::uuid <> p_org_id THEN
    RAISE EXCEPTION 'Invalid inbox storage path for org';
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
    p_org_id,
    p_created_by,
    'cloud_file',
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

REVOKE ALL ON FUNCTION create_intake_item_from_cloud_file(UUID, UUID, TEXT, TEXT, TEXT, BIGINT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_intake_item_from_cloud_file(UUID, UUID, TEXT, TEXT, TEXT, BIGINT, UUID) TO authenticated, service_role;
