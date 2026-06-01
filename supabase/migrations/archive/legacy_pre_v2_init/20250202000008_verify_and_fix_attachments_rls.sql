-- Verify and fix attachments INSERT RLS policy
-- This migration verifies the policy exists and uses the correct function

-- First, verify the function exists and works
DO $$
DECLARE
  v_function_exists BOOLEAN;
  v_policy_exists BOOLEAN;
  v_policy_definition TEXT;
BEGIN
  -- Check if function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'check_user_org_membership'
  ) INTO v_function_exists;
  
  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'Function check_user_org_membership does not exist';
  END IF;
  
  -- Check if policy exists
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'attachments'
      AND policyname = 'attachments_insert'
      AND cmd = 'INSERT'
  ) INTO v_policy_exists;
  
  IF NOT v_policy_exists THEN
    RAISE EXCEPTION 'Policy attachments_insert does not exist';
  END IF;
  
  -- Get policy definition
  SELECT with_check INTO v_policy_definition
  FROM pg_policies
  WHERE tablename = 'attachments'
    AND policyname = 'attachments_insert'
    AND cmd = 'INSERT';
  
  -- Log the policy definition
  RAISE NOTICE 'Policy exists. Definition: %', v_policy_definition;
  
  -- Verify the policy uses the function
  IF v_policy_definition NOT LIKE '%check_user_org_membership%' THEN
    RAISE WARNING 'Policy does not use check_user_org_membership function. Recreating...';
    
    -- Drop and recreate
    DROP POLICY IF EXISTS "attachments_insert" ON attachments;
    
    CREATE POLICY "attachments_insert" ON attachments
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() IS NOT NULL
        AND check_user_org_membership(org_id) = TRUE
      );
    
    RAISE NOTICE 'Policy recreated with check_user_org_membership function';
  ELSE
    RAISE NOTICE 'Policy correctly uses check_user_org_membership function';
  END IF;
END $$;

-- Also ensure the function is properly defined
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

-- Ensure permissions are granted
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO anon;

