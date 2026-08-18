-- Fix assets SELECT RLS policy to handle cases where current_org_id() is NULL
-- The app uses useActiveOrg() which reads from organisation_members, not JWT.
-- current_org_id() reads from auth.jwt() ->> 'active_org_id' which may not be set.
-- This caused inserted assets to be invisible even after successful creation.

DROP POLICY IF EXISTS "assets_select" ON assets;

CREATE POLICY "assets_select" ON assets
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
    AND (
      -- Non-staff users see all assets in their org
      (auth.jwt() ->> 'role') != 'staff'
      OR
      -- Staff users only see assets in assigned properties
      (
        (auth.jwt() ->> 'role') = 'staff'
        AND (
          property_id IS NULL
          OR property_id = ANY(assigned_properties())
        )
      )
      -- Fallback: if role is not set, allow access
      OR (auth.jwt() ->> 'role') IS NULL
    )
  );
