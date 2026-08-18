-- Add INSERT, UPDATE, DELETE policies for organisations and organisation_members
-- This fixes the database saving error when creating new accounts

-- ============================================================================
-- ORGANISATIONS INSERT/UPDATE/DELETE POLICIES
-- ============================================================================

-- Organisations: Authenticated users can create organisations
-- Note: We can't check created_by in WITH CHECK if column doesn't exist yet
-- So we allow any authenticated user to create, and rely on the application to set created_by
CREATE POLICY "organisations_insert" ON organisations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Organisations: Users can update their own orgs (if they're owner/manager)
CREATE POLICY "organisations_update" ON organisations
  FOR UPDATE
  USING (
    id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- Organisations: Only owners can delete
CREATE POLICY "organisations_delete" ON organisations
  FOR DELETE
  USING (
    id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role = 'owner'
    )
  );

-- ============================================================================
-- ORGANISATION MEMBERS INSERT/UPDATE/DELETE POLICIES
-- ============================================================================

-- Organisation Members: Users can create their own membership when creating an org
-- OR owners/managers can add other members
CREATE POLICY "organisation_members_insert" ON organisation_members
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      -- User is creating their own membership (for new org creation)
      user_id = auth.uid()
      OR
      -- User is owner/manager of the org (adding other members)
      org_id IN (
        SELECT org_id FROM organisation_members
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'manager')
      )
    )
  );

-- Organisation Members: Owners/managers can update memberships
CREATE POLICY "organisation_members_update" ON organisation_members
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- Organisation Members: Owners/managers can delete memberships
CREATE POLICY "organisation_members_delete" ON organisation_members
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

