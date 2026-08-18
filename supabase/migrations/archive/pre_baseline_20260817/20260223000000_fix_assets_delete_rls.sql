-- Fix assets DELETE RLS policy to match SELECT/INSERT pattern
-- The previous policy used current_org_id() which reads from JWT active_org_id.
-- When that's not set, current_org_id() returns NULL and the delete matches 0 rows
-- (Supabase returns 204 success with no error in that case).
-- Use the same membership check as assets_select and assets_insert.

DROP POLICY IF EXISTS "assets_delete" ON assets;

CREATE POLICY "assets_delete" ON assets
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );
