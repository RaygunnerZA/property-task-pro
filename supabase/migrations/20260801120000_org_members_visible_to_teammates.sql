-- Fix: teammates invisible in Team Settings / task assignee pickers.
--
-- Remote had multiple organisation_members SELECT policies that only allowed
-- `user_id = auth.uid()`, so each user could see only their own membership row.
-- Service-role showed Matthew + Justin as co-owners of SNC, but Justin's client
-- only received Justin — so assignees could not be assigned to tasks.
--
-- Solution (same intent as 20260312000001): SECURITY DEFINER user_org_ids()
-- plus a single SELECT policy for all members of shared orgs. Drop every
-- legacy own-row-only SELECT policy by name so none remain OR'd in.

CREATE OR REPLACE FUNCTION public.user_org_ids()
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

GRANT EXECUTE ON FUNCTION public.user_org_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_org_ids() TO service_role;

-- Drop known legacy SELECT policy names (idempotent)
DROP POLICY IF EXISTS "organisation_members_select" ON organisation_members;
DROP POLICY IF EXISTS "Select own membership" ON organisation_members;
DROP POLICY IF EXISTS "Users can SELECT their own organisation memberships" ON organisation_members;
DROP POLICY IF EXISTS "Users can read their membership" ON organisation_members;
DROP POLICY IF EXISTS "organisation_members_select_own" ON organisation_members;
DROP POLICY IF EXISTS "Members can view org members" ON organisation_members;
DROP POLICY IF EXISTS "Users can view members of their organisations" ON organisation_members;

-- Catch-all: drop any remaining SELECT policies on organisation_members
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organisation_members'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON organisation_members', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "organisation_members_select" ON organisation_members
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id = ANY(public.user_org_ids())
  );

COMMENT ON POLICY "organisation_members_select" ON organisation_members IS
  'Any authenticated member can list all memberships for orgs they belong to (team roster / assignees).';
