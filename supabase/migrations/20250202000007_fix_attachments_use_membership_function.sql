-- Fix attachments INSERT RLS policy to use check_user_org_membership function
-- This matches the pattern used successfully for properties, assets, and tasks
-- The function uses SECURITY DEFINER to bypass RLS when checking membership

-- Ensure the function exists (it should already exist from previous migrations)
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

-- Grant execute permission to authenticated users (if not already granted)
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO anon;

-- Drop existing attachments INSERT policy
DROP POLICY IF EXISTS "attachments_insert" ON attachments;
DROP POLICY IF EXISTS "attachments_insert_auth" ON attachments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON attachments;

-- Create new policy using the function (same pattern as properties/assets/tasks)
CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

-- Verify the policy was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attachments' 
    AND policyname = 'attachments_insert'
    AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'Policy attachments_insert was not created';
  END IF;
  RAISE NOTICE 'attachments_insert policy created successfully using check_user_org_membership function';
END $$;

