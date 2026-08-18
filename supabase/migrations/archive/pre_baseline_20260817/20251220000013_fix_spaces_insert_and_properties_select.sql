-- Fix spaces INSERT policy and properties SELECT policy for onboarding
-- Both should check membership instead of relying on current_org_id() which may not be set

-- ============================================================================
-- PROPERTIES: Fix SELECT policy to work during onboarding
-- ============================================================================
-- The current policy uses current_org_id() which reads from JWT active_org_id
-- During onboarding, this might not be set yet, so we also check membership

DROP POLICY IF EXISTS "properties_select" ON properties;

CREATE POLICY "properties_select" ON properties
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Check if org_id matches current_org_id() (for normal app usage)
      org_id = current_org_id()
      OR
      -- OR check if user is a member of the org (for onboarding)
      org_id IN (
        SELECT org_id FROM organisation_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- SPACES: Create INSERT policy
-- ============================================================================
-- Allow authenticated users to insert spaces if they are members of the org

CREATE POLICY "spaces_insert" ON spaces
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

-- ============================================================================
-- SPACES: Fix SELECT policy to work during onboarding
-- ============================================================================
-- Similar to properties, check membership as fallback

DROP POLICY IF EXISTS "spaces_select" ON spaces;

CREATE POLICY "spaces_select" ON spaces
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- Check if org_id matches current_org_id() (for normal app usage)
      org_id = current_org_id()
      OR
      -- OR check if user is a member of the org (for onboarding)
      org_id IN (
        SELECT org_id FROM organisation_members
        WHERE user_id = auth.uid()
      )
    )
  );

