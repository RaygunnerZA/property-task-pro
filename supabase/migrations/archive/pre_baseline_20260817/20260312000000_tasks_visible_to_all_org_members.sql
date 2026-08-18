-- Task visibility: all org tasks when dev mode is ON (JWT user_metadata.dev_mode),
-- otherwise staff see only assigned properties (role + assigned_properties in JWT).

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
      -- Dev mode ON (from client toggle, stored in user_metadata): see all org tasks
      COALESCE((auth.jwt() -> 'user_metadata' ->> 'dev_mode') = 'true', false)
      OR
      -- Non-staff users see all tasks in their org
      (auth.jwt() ->> 'role') != 'staff'
      OR
      -- Staff users only see tasks in assigned properties
      (
        (auth.jwt() ->> 'role') = 'staff'
        AND (
          property_id IS NULL
          OR property_id = ANY(assigned_properties())
        )
      )
      OR
      (auth.jwt() ->> 'role') IS NULL
    )
  );
