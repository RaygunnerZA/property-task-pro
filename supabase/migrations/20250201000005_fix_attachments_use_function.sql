-- Fix attachments INSERT RLS policy using check_user_org_membership function
-- This matches the exact pattern used successfully for properties, assets, and tasks
-- The function uses SECURITY DEFINER to bypass RLS on organisation_members

-- ============================================================================
-- STEP 1: Ensure the helper function exists (same as properties/assets/tasks)
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
-- STEP 2: Drop and recreate the attachments INSERT policy using the function
-- ============================================================================
DROP POLICY IF EXISTS "attachments_insert" ON attachments;

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
    WHERE schemaname = 'public'
      AND tablename = 'attachments'
      AND policyname = 'attachments_insert'
  ) THEN
    RAISE EXCEPTION 'Policy attachments_insert was not created';
  END IF;
END $$;

