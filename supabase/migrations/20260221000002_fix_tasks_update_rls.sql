-- Fix tasks UPDATE RLS policy — no UPDATE policy existed, so all authenticated
-- updates were silently denied (0 rows affected, no error).
-- Mirror the same membership check used by tasks_select and fix_assets_update_rls.

DROP POLICY IF EXISTS "tasks_update" ON tasks;

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = tasks.org_id
        AND organisation_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = tasks.org_id
        AND organisation_members.user_id = auth.uid()
    )
  );
