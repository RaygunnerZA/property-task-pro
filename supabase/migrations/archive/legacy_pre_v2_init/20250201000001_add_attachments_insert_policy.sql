-- Add INSERT policy for attachments table
-- Allows authenticated users to insert attachments if they are members of the org
-- Uses the same check_user_org_membership function as other tables

-- Ensure the helper function exists (from 20251220000011_fix_insert_policies_properties_assets_tasks.sql)
CREATE OR REPLACE FUNCTION check_user_org_membership(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  -- Return false if no user
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if membership exists (bypasses RLS due to SECURITY DEFINER)
  SELECT COUNT(*) INTO v_count
  FROM organisation_members
  WHERE org_id = p_org_id
    AND user_id = v_user_id;
  
  RETURN v_count > 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO anon;

-- ============================================================================
-- ATTACHMENTS: INSERT Policy
-- ============================================================================
-- Allow authenticated users to insert attachments if they are members of the org

DROP POLICY IF EXISTS "attachments_insert" ON attachments;

CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

-- ============================================================================
-- ATTACHMENTS: UPDATE Policy (for thumbnail_url updates)
-- ============================================================================
-- Allow authenticated users to update attachments if they are members of the org

DROP POLICY IF EXISTS "attachments_update" ON attachments;

CREATE POLICY "attachments_update" ON attachments
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

