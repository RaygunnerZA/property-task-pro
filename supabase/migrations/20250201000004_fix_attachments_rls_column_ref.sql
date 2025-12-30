-- Fix attachments INSERT RLS policy - correct column reference
-- In WITH CHECK clauses, reference columns directly without table prefix

DROP POLICY IF EXISTS "attachments_insert" ON attachments;

CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

