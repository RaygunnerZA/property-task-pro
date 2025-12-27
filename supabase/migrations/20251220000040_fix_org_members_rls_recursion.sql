-- Fix infinite recursion in organisation_members RLS policy
-- The policy was querying organisation_members from within its own policy check,
-- causing infinite recursion (error 42P17)
--
-- Solution: Simplify the policy to only check user_id = auth.uid()
-- This is sufficient for useActiveOrg and prevents recursion

-- ============================================================================
-- ORGANISATION MEMBERS SELECT POLICY
-- ============================================================================

DROP POLICY IF EXISTS "organisation_members_select" ON organisation_members;

-- Simplified policy: Users can only see their own memberships
-- This prevents infinite recursion and is sufficient for useActiveOrg
CREATE POLICY "organisation_members_select" ON organisation_members
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

-- ============================================================================
-- NOTE: If you need to see other members' memberships in the same org,
-- create a separate policy or use a SECURITY DEFINER function that bypasses RLS
-- ============================================================================

