-- Team: all org members see every member in orgs they belong to (inviter and invited both visible).
-- Previously only owner/manager could see the full list; staff saw only their own row.

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
