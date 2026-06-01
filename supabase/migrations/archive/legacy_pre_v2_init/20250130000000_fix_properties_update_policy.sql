-- Fix properties UPDATE policy to allow all org members to update
-- The previous policy required current_org_id() which may not be set in JWT
-- and also restricted updates to owners/managers only

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "properties_update" ON properties;

-- Create new UPDATE policy that checks membership (like INSERT policy)
-- Allows all org members to update properties in their org
CREATE POLICY "properties_update" ON properties
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

