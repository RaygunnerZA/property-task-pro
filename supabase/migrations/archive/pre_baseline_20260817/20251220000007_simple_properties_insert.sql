-- SIMPLE FIX: Direct membership check without function
-- This is simpler and should work immediately

-- Drop the existing policy
DROP POLICY IF EXISTS "properties_insert" ON properties;

-- Create a simple policy that directly checks membership
-- This should work because we can query organisation_members by user_id
CREATE POLICY "properties_insert" ON properties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM organisation_members
      WHERE org_id = properties.org_id
        AND user_id = auth.uid()
    )
  );

