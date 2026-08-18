-- FINAL FIX: Properties INSERT policy that explicitly bypasses RLS
-- This version uses SECURITY DEFINER with explicit RLS bypass

-- Drop the policy first (it depends on the function)
DROP POLICY IF EXISTS "properties_insert" ON properties;

-- Drop existing function
DROP FUNCTION IF EXISTS is_org_member(UUID);

-- Create function that explicitly bypasses RLS
CREATE OR REPLACE FUNCTION is_org_member(org_uuid UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_uuid UUID;
  member_count INTEGER;
BEGIN
  -- Get current user
  user_uuid := auth.uid();
  
  IF user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Query with explicit RLS bypass using SECURITY DEFINER
  -- This runs as the function owner (postgres) and bypasses all RLS
  SELECT COUNT(*) INTO member_count
  FROM organisation_members
  WHERE org_id = org_uuid
    AND user_id = user_uuid;
  
  RETURN member_count > 0;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_org_member(UUID) TO anon;

-- Recreate the policy
CREATE POLICY "properties_insert" ON properties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND is_org_member(org_id)
  );

-- Verify the policy was created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'properties' 
    AND policyname = 'properties_insert'
  ) THEN
    RAISE EXCEPTION 'Policy properties_insert was not created';
  END IF;
END $$;

