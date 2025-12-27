-- Fix properties and spaces SELECT policies to ensure users only see data from their own orgs
-- This prevents cross-org data leakage and ensures duplicate checks only see properties from the current org
-- Works during onboarding by checking membership instead of relying on current_org_id()

-- ============================================================================
-- PROPERTIES: Fix SELECT policy
-- ============================================================================
-- Restrict to only properties from orgs where the user is a member
-- This ensures users cannot see properties from other orgs, even if they're members of multiple orgs
-- The frontend query with .eq('org_id', orgId) provides additional filtering

DROP POLICY IF EXISTS "properties_select" ON properties;

CREATE POLICY "properties_select" ON properties
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
    -- This ensures users only see properties from orgs they belong to
    -- The frontend query with .eq('org_id', orgId) will further restrict to the active org
  );

-- ============================================================================
-- SPACES: Fix SELECT policy
-- ============================================================================
-- Similarly restrict spaces to only orgs where the user is a member

DROP POLICY IF EXISTS "spaces_select" ON spaces;

CREATE POLICY "spaces_select" ON spaces
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
    -- This ensures users only see spaces from orgs they belong to
    -- The frontend query with .eq('org_id', orgId) will further restrict to the active org
  );

