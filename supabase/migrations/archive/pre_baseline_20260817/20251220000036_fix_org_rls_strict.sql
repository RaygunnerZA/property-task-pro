-- Fix RLS policies for organisations and organisation_members
-- Ensure users can only see organizations they are members of
-- This fixes the issue where new users see organizations that don't belong to them

-- ============================================================================
-- ORGANISATIONS SELECT POLICY
-- ============================================================================
-- Drop existing policy and create a strict one that ensures users only see
-- organizations where they have a membership record

DROP POLICY IF EXISTS "organisations_select" ON organisations;

CREATE POLICY "organisations_select" ON organisations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND id IN (
      SELECT org_id 
      FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- ORGANISATION MEMBERS SELECT POLICY
-- ============================================================================
-- Ensure users can only see their own memberships or memberships in orgs they belong to
-- This is critical for useActiveOrg to work correctly

DROP POLICY IF EXISTS "organisation_members_select" ON organisation_members;

CREATE POLICY "organisation_members_select" ON organisation_members
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Users can see their own memberships (needed for useActiveOrg)
      user_id = auth.uid()
      OR
      -- Users can see memberships for orgs they belong to (for current_org_id() queries)
      (org_id IN (
        SELECT org_id 
        FROM organisation_members
        WHERE user_id = auth.uid()
      ))
    )
  );

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- This query can be run manually to verify RLS is working:
-- SELECT id, name, created_by FROM organisations;
-- Should only return orgs where the current user has a membership

-- ============================================================================
-- CLEANUP ORPHANED DATA (Optional - uncomment if needed)
-- ============================================================================
-- If there are any orphaned memberships (memberships without valid orgs),
-- or orgs without memberships, they will be hidden by RLS but can be cleaned up:
-- 
-- DELETE FROM organisation_members 
-- WHERE org_id NOT IN (SELECT id FROM organisations);
-- 
-- Note: Only run this if you're sure about the data integrity

