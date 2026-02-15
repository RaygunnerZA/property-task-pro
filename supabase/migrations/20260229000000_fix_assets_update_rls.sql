-- Fix assets UPDATE RLS policy to match SELECT/INSERT/DELETE pattern
-- The previous policy used current_org_id() which reads from JWT active_org_id.
-- When that's not set, current_org_id() returns NULL and the update matches 0 rows
-- (Supabase returns success but no rows are actually updated).
-- Use the same membership check as assets_select, assets_insert, assets_delete.

DROP POLICY IF EXISTS "assets_update" ON assets;

CREATE POLICY "assets_update" ON assets
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
