-- Final fix: Remove the simple auth policy and ensure only org membership policy exists
-- This ensures only members of the org can insert attachments

-- ============================================================================
-- STEP 1: Drop the simple auth-only policy (too permissive)
-- ============================================================================

DROP POLICY IF EXISTS "attachments_insert_auth" ON attachments;

-- ============================================================================
-- STEP 2: Ensure check_user_org_membership function is correct
-- ============================================================================

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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO anon;

-- ============================================================================
-- STEP 3: Ensure the correct policy exists
-- ============================================================================

DROP POLICY IF EXISTS "attachments_insert" ON attachments;

CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

-- ============================================================================
-- STEP 4: Verify
-- ============================================================================

DO $$
DECLARE
  policy_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attachments' 
    AND policyname = 'attachments_insert'
    AND cmd = 'INSERT'
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    RAISE EXCEPTION 'Policy attachments_insert was not created';
  END IF;
  
  RAISE NOTICE 'Successfully created attachments_insert policy';
END $$;

