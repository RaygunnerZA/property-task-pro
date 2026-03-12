-- Accept both string 'true' and boolean true for user_metadata.dev_mode in JWT (Supabase may send either).
DROP POLICY IF EXISTS "tasks_select" ON tasks;

CREATE POLICY "tasks_select" ON tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = tasks.org_id
        AND organisation_members.user_id = auth.uid()
    )
    AND (
      -- Dev mode ON: string or boolean true in user_metadata
      (
        (auth.jwt() -> 'user_metadata' ->> 'dev_mode') = 'true'
        OR (auth.jwt() -> 'user_metadata' -> 'dev_mode') = 'true'::jsonb
      )
      OR (auth.jwt() ->> 'role') != 'staff'
      OR (
        (auth.jwt() ->> 'role') = 'staff'
        AND (property_id IS NULL OR property_id = ANY(assigned_properties()))
      )
      OR (auth.jwt() ->> 'role') IS NULL
    )
  );
