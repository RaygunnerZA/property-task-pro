-- Stage 1 hardening follow-up
-- - strict storage key enforcement for inbox bucket: orgs/<org_id>/inbox/<...>
-- - remove inbox UPDATE policy (least privilege)
-- - harden compliance_sources intake writes via SECURITY DEFINER RPC

-- Traceability fields for intake records
ALTER TABLE compliance_sources
  ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT;

CREATE INDEX IF NOT EXISTS idx_compliance_sources_org_created_at
  ON compliance_sources (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_sources_storage_path
  ON compliance_sources (storage_path);

-- Replace Stage 1 inbox policies (exact names from 20260303000001)
DROP POLICY IF EXISTS "Users can upload inbox files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read inbox files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update inbox files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete inbox files" ON storage.objects;

-- Strict key shape:
--   orgs/<org_uuid>/inbox/<file_or_subpath...>
CREATE POLICY "Users can upload inbox files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inbox'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = 'orgs'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3) = 'inbox'
  AND split_part(name, '/', 4) <> ''
  AND check_user_org_membership(split_part(name, '/', 2)::uuid) = TRUE
);

CREATE POLICY "Users can read inbox files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'inbox'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = 'orgs'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3) = 'inbox'
  AND split_part(name, '/', 4) <> ''
  AND check_user_org_membership(split_part(name, '/', 2)::uuid) = TRUE
);

-- Intentionally no UPDATE policy for inbox objects.
CREATE POLICY "Users can delete inbox files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'inbox'
  AND auth.uid() IS NOT NULL
  AND split_part(name, '/', 1) = 'orgs'
  AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND split_part(name, '/', 3) = 'inbox'
  AND split_part(name, '/', 4) <> ''
  AND check_user_org_membership(split_part(name, '/', 2)::uuid) = TRUE
);

-- Remove direct client insert path; use RPC below instead.
DROP POLICY IF EXISTS "compliance_sources_insert" ON compliance_sources;

CREATE OR REPLACE FUNCTION create_compliance_source_from_inbox(
  p_id UUID,
  p_storage_path TEXT,
  p_file_name TEXT,
  p_mime_type TEXT,
  p_file_size BIGINT,
  p_source TEXT DEFAULT 'global_dropzone'
)
RETURNS compliance_sources
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_row compliance_sources;
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

  IF check_user_org_membership(v_org_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'No organisation membership for storage path org';
  END IF;

  INSERT INTO compliance_sources (
    id,
    org_id,
    created_by,
    storage_bucket,
    storage_path,
    file_name,
    mime_type,
    file_size,
    source,
    status
  )
  VALUES (
    COALESCE(p_id, gen_random_uuid()),
    v_org_id,
    auth.uid(),
    'inbox',
    p_storage_path,
    p_file_name,
    NULLIF(p_mime_type, ''),
    p_file_size,
    COALESCE(NULLIF(p_source, ''), 'global_dropzone'),
    'uploaded'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION create_compliance_source_from_inbox(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_compliance_source_from_inbox(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT) TO authenticated;
