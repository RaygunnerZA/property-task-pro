-- Fix ambiguous column reference in create_attachment_record function
-- Drop and recreate the function with all column references properly qualified

DROP FUNCTION IF EXISTS create_attachment_record(
  UUID, TEXT, TEXT, UUID, TEXT, TEXT, BIGINT, TEXT
);

CREATE OR REPLACE FUNCTION create_attachment_record(
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
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  -- Verify user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Verify user is a member of the org (optional security check)
  -- This adds an extra layer of security even though RLS is bypassed
  -- Use table alias to avoid ambiguity
  IF NOT EXISTS (
    SELECT 1 
    FROM organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of the specified organization';
  END IF;
  
  -- Insert the attachment record
  -- All values use parameter names (p_ prefix) to avoid ambiguity
  INSERT INTO attachments (
    org_id,
    file_url,
    parent_type,
    parent_id,
    file_name,
    file_type,
    file_size,
    thumbnail_url
  )
  VALUES (
    p_org_id,
    p_file_url,
    p_parent_type,
    p_parent_id,
    p_file_name,
    p_file_type,
    p_file_size,
    p_thumbnail_url
  )
  RETURNING * INTO v_result;
  
  -- Return the inserted row
  -- Use v_result record fields to avoid ambiguity
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_attachment_record(
  UUID, TEXT, TEXT, UUID, TEXT, TEXT, BIGINT, TEXT
) TO authenticated;

-- Verify the function was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'create_attachment_record'
  ) THEN
    RAISE EXCEPTION 'Function create_attachment_record was not created';
  END IF;
  RAISE NOTICE 'Function create_attachment_record recreated successfully with unambiguous references';
END $$;

