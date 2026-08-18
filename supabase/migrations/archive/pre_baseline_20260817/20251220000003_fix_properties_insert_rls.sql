-- Fix properties INSERT policy to use a SECURITY DEFINER function
-- This bypasses RLS when checking membership, avoiding timing issues

-- Create a helper function to check if user is a member of an org
CREATE OR REPLACE FUNCTION is_org_member(org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = org_uuid
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Drop the existing policy
DROP POLICY IF EXISTS "properties_insert" ON properties;

-- Create a new policy that uses the helper function
CREATE POLICY "properties_insert" ON properties
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND is_org_member(org_id)
  );

