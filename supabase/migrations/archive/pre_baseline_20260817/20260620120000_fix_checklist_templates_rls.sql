-- Fix checklist_templates RLS to use organisation_members membership.
-- The app resolves active org via useActiveOrg() (organisation_members), not JWT active_org_id.
-- current_org_id() may be NULL, which blocked insert/select and made starter templates unusable.

DROP POLICY IF EXISTS "checklist_templates_select" ON checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_insert" ON checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_update" ON checklist_templates;
DROP POLICY IF EXISTS "checklist_templates_delete" ON checklist_templates;

CREATE POLICY "checklist_templates_select" ON checklist_templates
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "checklist_templates_insert" ON checklist_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "checklist_templates_update" ON checklist_templates
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "checklist_templates_delete" ON checklist_templates
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );
