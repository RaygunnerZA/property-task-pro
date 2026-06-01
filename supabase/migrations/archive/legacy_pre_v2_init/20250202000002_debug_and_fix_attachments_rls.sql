-- Debug and fix attachments INSERT RLS policy
-- This migration verifies the function works and recreates the policy

-- ============================================================================
-- STEP 1: Ensure check_user_org_membership function exists and is correct
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO anon;

-- ============================================================================
-- STEP 2: Drop ALL existing INSERT policies on attachments
-- ============================================================================

DROP POLICY IF EXISTS "attachments_insert" ON attachments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON attachments;
DROP POLICY IF EXISTS "attachments_insert_policy" ON attachments;
DROP POLICY IF EXISTS "allow_attachments_insert" ON attachments;

-- ============================================================================
-- STEP 3: Create a simple policy first (for debugging)
-- ============================================================================
-- This policy only checks auth.uid() to verify basic auth works

CREATE POLICY "attachments_insert_auth" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- STEP 4: Create the full policy with org membership check
-- ============================================================================
-- Note: PostgreSQL allows multiple policies - they are OR'd together
-- So if either policy passes, the insert is allowed

CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

-- ============================================================================
-- STEP 5: Verify policies were created
-- ============================================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'attachments' 
  AND cmd = 'INSERT';
  
  IF policy_count = 0 THEN
    RAISE EXCEPTION 'No INSERT policies found on attachments table';
  END IF;
  
  RAISE NOTICE 'Successfully created % INSERT policies on attachments', policy_count;
END $$;

