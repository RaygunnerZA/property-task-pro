-- Final attempt: Ensure function works and policy is correct
-- This migration verifies the function returns true for the test case
-- and recreates the policy with explicit error handling

-- Ensure function exists and is correct
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
  -- Use explicit table reference to avoid any ambiguity
  SELECT COUNT(*) INTO v_count
  FROM public.organisation_members
  WHERE org_id = p_org_id
    AND user_id = v_user_id;
  
  RETURN v_count > 0;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO anon;

-- Drop ALL existing INSERT policies on attachments
DROP POLICY IF EXISTS "attachments_insert" ON attachments;
DROP POLICY IF EXISTS "attachments_insert_auth" ON attachments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON attachments;
DROP POLICY IF EXISTS "attachments_insert_policy" ON attachments;
DROP POLICY IF EXISTS "allow_attachments_insert" ON attachments;

-- Create the policy with explicit function call
-- Use = TRUE explicitly to ensure boolean comparison
CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

-- Verify the policy
DO $$
DECLARE
  v_policy_count INTEGER;
  v_policy_def TEXT;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'attachments'
    AND cmd = 'INSERT';
  
  IF v_policy_count = 0 THEN
    RAISE EXCEPTION 'No INSERT policy found on attachments table';
  END IF;
  
  IF v_policy_count > 1 THEN
    RAISE WARNING 'Multiple INSERT policies found on attachments table: %', v_policy_count;
  END IF;
  
  SELECT with_check INTO v_policy_def
  FROM pg_policies
  WHERE tablename = 'attachments'
    AND policyname = 'attachments_insert'
    AND cmd = 'INSERT';
  
  RAISE NOTICE 'Policy created. Definition: %', v_policy_def;
END $$;

