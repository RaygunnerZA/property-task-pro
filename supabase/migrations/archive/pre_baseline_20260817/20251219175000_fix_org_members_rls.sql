-- Fix organisation_members RLS policy to allow users to see their own memberships
-- This is needed for useActiveOrg hook to work, which queries by user_id
-- The current policy only allows queries where org_id = current_org_id(),
-- but we need to allow users to query their own memberships to find their orgs

-- Drop the existing policy
DROP POLICY IF EXISTS "organisation_members_select" ON organisation_members;

-- Create a new policy that allows users to see their own memberships
-- This enables useActiveOrg to work by querying organisation_members by user_id
CREATE POLICY "organisation_members_select" ON organisation_members
  FOR SELECT
  USING (
    -- Users can see their own memberships (needed for useActiveOrg)
    user_id = auth.uid()
    OR
    -- Users can see memberships for orgs they belong to (for current_org_id() queries)
    org_id = current_org_id()
  );

