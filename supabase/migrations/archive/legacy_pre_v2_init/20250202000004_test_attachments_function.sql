-- Test and verify the check_user_org_membership function works correctly
-- This migration helps debug why the RLS policy might be failing

-- ============================================================================
-- STEP 1: Create a test function to verify membership
-- ============================================================================
-- This function can be called manually to test if membership exists

CREATE OR REPLACE FUNCTION test_user_org_membership(p_org_id UUID)
RETURNS TABLE(
  user_id UUID,
  org_id UUID,
  is_member BOOLEAN,
  membership_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    auth.uid() as user_id,
    p_org_id as org_id,
    (SELECT COUNT(*) > 0 FROM organisation_members 
     WHERE org_id = p_org_id AND user_id = auth.uid()) as is_member,
    (SELECT COUNT(*) FROM organisation_members 
     WHERE org_id = p_org_id AND user_id = auth.uid()) as membership_count;
END;
$$;

GRANT EXECUTE ON FUNCTION test_user_org_membership(UUID) TO authenticated;

-- ============================================================================
-- STEP 2: Ensure the main function is correct and add better error handling
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
  
  -- Return false if org_id is NULL
  IF p_org_id IS NULL THEN
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

-- ============================================================================
-- STEP 3: Recreate the policy with explicit NULL checks
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
-- STEP 4: Add a comment for debugging
-- ============================================================================

COMMENT ON POLICY "attachments_insert" ON attachments IS 
  'Allows authenticated users who are members of the org to insert attachments. 
   Uses check_user_org_membership function which bypasses RLS to verify membership.';

