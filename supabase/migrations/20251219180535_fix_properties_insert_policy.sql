-- Fix properties INSERT policy to check membership instead of current_org_id()
-- This is needed because JWT might not have active_org_id set yet during onboarding

-- Drop the existing policy
DROP POLICY IF EXISTS "properties_insert" ON properties;

-- Create a new policy that checks membership
CREATE POLICY "properties_insert" ON properties
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

