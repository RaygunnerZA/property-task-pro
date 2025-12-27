-- Fix tasks SELECT RLS policy to handle cases where current_org_id() is NULL
-- This ensures tasks are visible even if active_org_id isn't set in JWT

DROP POLICY IF EXISTS "tasks_select" ON tasks;

CREATE POLICY "tasks_select" ON tasks
  FOR SELECT
  USING (
    -- Check if user is a member of the org that owns the task
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = tasks.org_id
        AND organisation_members.user_id = auth.uid()
    )
    AND (
      -- Non-staff users see all tasks in their org
      (auth.jwt() ->> 'role') != 'staff'
      OR
      -- Staff users only see tasks in assigned properties
      (
        (auth.jwt() ->> 'role') = 'staff'
        AND (
          -- If property_id is NULL, staff can see it (or change to FALSE to hide)
          property_id IS NULL
          OR property_id = ANY(assigned_properties())
        )
      )
      OR
      -- Fallback: if role is not set, allow access (for non-staff users)
      (auth.jwt() ->> 'role') IS NULL
    )
  );

