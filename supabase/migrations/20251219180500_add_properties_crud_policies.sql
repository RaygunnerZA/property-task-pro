-- Add INSERT, UPDATE, DELETE policies for properties table
-- Properties can be created/updated/deleted by members of the organisation

-- Properties: Authenticated users can create properties in orgs they belong to
-- We check membership instead of current_org_id() because JWT might not have active_org_id set yet
CREATE POLICY "properties_insert" ON properties
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

-- Properties: Users can update properties in their org (if they're owner/manager)
CREATE POLICY "properties_update" ON properties
  FOR UPDATE
  USING (
    org_id = current_org_id()
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- Properties: Users can delete properties in their org (if they're owner/manager)
CREATE POLICY "properties_delete" ON properties
  FOR DELETE
  USING (
    org_id = current_org_id()
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

