-- Fix properties INSERT policy - Version 2
-- This version ensures the function can bypass RLS completely

-- Drop the existing policy first (it depends on the function)
DROP POLICY IF EXISTS "properties_insert" ON properties;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS is_org_member(UUID);

-- Create a helper function that bypasses RLS completely
-- SECURITY DEFINER runs with the privileges of the function owner (postgres)
-- This allows it to read organisation_members without RLS restrictions
CREATE OR REPLACE FUNCTION is_org_member(org_uuid UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_uuid UUID;
  member_exists BOOLEAN;
BEGIN
  -- Get the current user ID
  user_uuid := auth.uid();
  
  -- If no user, return false
  IF user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if membership exists (bypasses RLS due to SECURITY DEFINER)
  SELECT EXISTS (
    SELECT 1 
    FROM organisation_members
    WHERE org_id = org_uuid
    AND user_id = user_uuid
  ) INTO member_exists;
  
  RETURN COALESCE(member_exists, FALSE);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_org_member(UUID) TO authenticated;

-- Create a new policy that uses the helper function
CREATE POLICY "properties_insert" ON properties
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND is_org_member(org_id) = TRUE
  );

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'properties' 
  AND policyname = 'properties_insert';

