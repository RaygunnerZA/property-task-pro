-- Restore create_attachment_record for environments that lost the archived RPC.
-- Client upload paths also insert directly; this keeps RPC callers / types working.

CREATE OR REPLACE FUNCTION public.create_attachment_record(
  p_org_id UUID,
  p_file_url TEXT,
  p_parent_type TEXT,
  p_parent_id UUID,
  p_file_name TEXT DEFAULT NULL,
  p_file_type TEXT DEFAULT NULL,
  p_file_size BIGINT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  org_id UUID,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  parent_type TEXT,
  parent_id UUID,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result RECORD;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of the specified organization';
  END IF;

  INSERT INTO public.attachments (
    org_id,
    file_url,
    parent_type,
    parent_id,
    file_name,
    file_type,
    file_size,
    thumbnail_url,
    upload_status
  )
  VALUES (
    p_org_id,
    p_file_url,
    p_parent_type,
    p_parent_id,
    p_file_name,
    p_file_type,
    p_file_size,
    p_thumbnail_url,
    'complete'
  )
  RETURNING * INTO v_result;

  RETURN QUERY SELECT
    v_result.id,
    v_result.org_id,
    v_result.file_url,
    v_result.file_name,
    v_result.file_type,
    v_result.file_size,
    v_result.parent_type,
    v_result.parent_id,
    v_result.thumbnail_url,
    v_result.created_at,
    v_result.updated_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_attachment_record(
  UUID, TEXT, TEXT, UUID, TEXT, TEXT, BIGINT, TEXT
) TO authenticated;
