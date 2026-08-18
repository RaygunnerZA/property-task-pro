-- FINAL FIX: Use SECURITY DEFINER function to bypass RLS completely
-- This will definitely work because the function runs as postgres user

-- Step 1: Create a function that bypasses RLS
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
  -- Get current user
  v_user_id := auth.uid();
  
  -- Return false if no user
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check membership (bypasses RLS due to SECURITY DEFINER)
  SELECT COUNT(*) INTO v_count
  FROM organisation_members
  WHERE org_id = p_org_id
    AND user_id = v_user_id;
  
  RETURN v_count > 0;
END;
$$;

-- Step 2: Grant execute permission
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO anon;

-- Step 3: Drop existing policy
DROP POLICY IF EXISTS "properties_insert" ON properties;

-- Step 4: Create new policy using the function
CREATE POLICY "properties_insert" ON properties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

-- Step 5: Verify it was created
SELECT 
  'Policy created successfully' as status,
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'properties' 
  AND policyname = 'properties_insert';

