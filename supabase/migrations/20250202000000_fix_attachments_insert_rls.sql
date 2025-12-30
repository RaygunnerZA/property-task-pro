-- Fix attachments INSERT RLS policy to verify org membership
-- This ensures users can only insert attachments for orgs they belong to

-- ============================================================================
-- STEP 1: Ensure check_user_org_membership function exists
-- ============================================================================
-- This function bypasses RLS by running as postgres user (SECURITY DEFINER)
-- This ensures membership checks work even during onboarding when JWT might not be fully set

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
-- STEP 2: Fix attachments INSERT policy
-- ============================================================================
-- Drop existing policies
DROP POLICY IF EXISTS "attachments_insert" ON attachments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON attachments;

-- Create new policy that verifies org membership
CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

-- ============================================================================
-- STEP 3: Verify the policy was created
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attachments' 
    AND policyname = 'attachments_insert'
  ) THEN
    RAISE EXCEPTION 'Policy attachments_insert was not created';
  END IF;
END $$;

