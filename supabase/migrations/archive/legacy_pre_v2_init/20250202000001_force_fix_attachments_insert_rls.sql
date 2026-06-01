-- Force fix attachments INSERT RLS policy
-- This migration ensures the correct policy is in place by dropping ALL possible policy names
-- and recreating with org membership verification

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
-- STEP 2: Drop ALL possible INSERT policies on attachments
-- ============================================================================
-- Drop every possible policy name that might exist

DROP POLICY IF EXISTS "attachments_insert" ON attachments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON attachments;
DROP POLICY IF EXISTS "attachments_insert_policy" ON attachments;
DROP POLICY IF EXISTS "allow_attachments_insert" ON attachments;

-- ============================================================================
-- STEP 3: Create the correct INSERT policy with org membership check
-- ============================================================================

CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

-- ============================================================================
-- STEP 4: Verify the policy was created correctly
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
    RAISE EXCEPTION 'Policy attachments_insert was not created correctly';
  END IF;
END $$;

