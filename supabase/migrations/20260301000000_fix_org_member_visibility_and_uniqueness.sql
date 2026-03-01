-- Ensure one membership per user/org and allow owner/manager team visibility
-- Needed for Team Settings to display full membership lists safely.

-- Avoid duplicate memberships when users are invited multiple times.
CREATE UNIQUE INDEX IF NOT EXISTS organisation_members_org_user_unique
ON organisation_members(org_id, user_id);

-- SECURITY DEFINER helper avoids RLS recursion when checking caller role.
CREATE OR REPLACE FUNCTION is_org_owner_or_manager(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_role TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role
  INTO v_role
  FROM organisation_members
  WHERE org_id = p_org_id
    AND user_id = v_uid
  LIMIT 1;

  RETURN v_role IN ('owner', 'manager');
END;
$$;

GRANT EXECUTE ON FUNCTION is_org_owner_or_manager(UUID) TO authenticated;

DROP POLICY IF EXISTS "organisation_members_select" ON organisation_members;

CREATE POLICY "organisation_members_select" ON organisation_members
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR is_org_owner_or_manager(org_id) = TRUE
    )
  );
