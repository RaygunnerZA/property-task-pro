-- Run this in Supabase Dashboard → SQL Editor if "supabase db push" fails due to migration order.
-- Applies: tasks dev-mode visibility + org members visible to all in org.

-- ========== 1. tasks_select (dev mode = see all org tasks) ==========
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
      COALESCE((auth.jwt() -> 'user_metadata' ->> 'dev_mode') = 'true', false)
      OR (auth.jwt() ->> 'role') != 'staff'
      OR (
        (auth.jwt() ->> 'role') = 'staff'
        AND (property_id IS NULL OR property_id = ANY(assigned_properties()))
      )
      OR (auth.jwt() ->> 'role') IS NULL
    )
  );

-- ========== 2. organisation_members_select (all org members visible) ==========
CREATE OR REPLACE FUNCTION user_org_ids()
RETURNS UUID[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(array_agg(org_id), ARRAY[]::UUID[])
    FROM organisation_members
    WHERE user_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION user_org_ids() TO authenticated;

DROP POLICY IF EXISTS "organisation_members_select" ON organisation_members;

CREATE POLICY "organisation_members_select" ON organisation_members
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id = ANY(user_org_ids())
  );
