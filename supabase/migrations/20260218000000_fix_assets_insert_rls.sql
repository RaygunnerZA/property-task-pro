-- Fix assets INSERT RLS policy for Create Task flow
-- The previous policy used check_user_org_membership(org_id) which can fail when
-- current_org_id()/JWT context differs from useActiveOrg() (which reads from organisation_members).
-- Use the same inline membership check as properties_insert for consistency.

DROP POLICY IF EXISTS "assets_insert" ON assets;

CREATE POLICY "assets_insert" ON assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );
