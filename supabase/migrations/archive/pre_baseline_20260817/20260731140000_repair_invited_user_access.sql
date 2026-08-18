-- Repair invited-user access
--
-- Root cause: many RLS policies gate on current_org_id(), which only reads
-- JWT app_metadata.org_id. inviteUserByEmail / accept_invitation never set
-- app_metadata.org_id, so invited members could join organisation_members but
-- still see zero properties/tasks/spaces.
--
-- This migration:
--   1. Makes current_org_id() fall back to organisation_members (prefer non-personal)
--   2. Aligns properties/spaces/tasks SELECT with membership (Docs / prior migrations)
--   3. Backfills missing memberships from invitations (by email)
--   4. Backfills auth app_metadata.org_id + invited user_metadata flags
--   5. Teaches accept_invitation to stamp app_metadata.org_id going forward

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. current_org_id — JWT first, then membership fallback
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT COALESCE(
    NULLIF(
      (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb
        -> 'app_metadata' ->> 'org_id'),
      ''
    )::uuid,
    (
      SELECT om.org_id
      FROM organisation_members om
      LEFT JOIN organisations o ON o.id = om.org_id
      WHERE om.user_id = auth.uid()
      ORDER BY
        CASE WHEN o.org_type IS DISTINCT FROM 'personal' THEN 0 ELSE 1 END,
        om.created_at ASC NULLS LAST
      LIMIT 1
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, anon, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Core SELECT policies — membership-based (does not rely on JWT org_id alone)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "properties_select" ON properties;
CREATE POLICY "properties_select" ON properties
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "spaces_select" ON spaces;
CREATE POLICY "spaces_select" ON spaces
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = tasks.org_id
        AND organisation_members.user_id = auth.uid()
    )
    AND (
      (
        (auth.jwt() -> 'app_metadata' ->> 'dev_mode') = 'true'
        OR (auth.jwt() -> 'app_metadata' -> 'dev_mode') = 'true'::jsonb
      )
      OR (auth.jwt() ->> 'role') IS DISTINCT FROM 'staff'
      OR (
        (auth.jwt() ->> 'role') = 'staff'
        AND (property_id IS NULL OR property_id = ANY(assigned_properties()))
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Backfill organisation_members from invitations (pending / accepted / expired
--    where the auth user exists but membership is missing)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO organisation_members (org_id, user_id, role, assigned_properties)
SELECT DISTINCT ON (i.org_id, u.id)
  i.org_id,
  u.id,
  COALESCE(i.role, 'member'),
  i.property_ids
FROM invitations i
JOIN auth.users u ON lower(u.email) = lower(i.email)
WHERE i.org_id IS NOT NULL
  AND i.status IN ('pending', 'accepted', 'expired')
  AND NOT EXISTS (
    SELECT 1
    FROM organisation_members om
    WHERE om.org_id = i.org_id
      AND om.user_id = u.id
  )
ORDER BY i.org_id, u.id, i.created_at DESC NULLS LAST;

-- Mark those invitations accepted when the user now has membership
UPDATE invitations i
SET
  status = 'accepted',
  accepted_at = COALESCE(i.accepted_at, now()),
  updated_at = now()
FROM auth.users u
WHERE lower(u.email) = lower(i.email)
  AND i.status IN ('pending', 'expired')
  AND EXISTS (
    SELECT 1
    FROM organisation_members om
    WHERE om.org_id = i.org_id
      AND om.user_id = u.id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Stamp JWT app_metadata.org_id + invited flags for members missing them
-- ─────────────────────────────────────────────────────────────────────────────

WITH primary_membership AS (
  SELECT DISTINCT ON (om.user_id)
    om.user_id,
    om.org_id,
    om.role
  FROM organisation_members om
  LEFT JOIN organisations o ON o.id = om.org_id
  ORDER BY
    om.user_id,
    CASE WHEN o.org_type IS DISTINCT FROM 'personal' THEN 0 ELSE 1 END,
    om.created_at ASC NULLS LAST
)
UPDATE auth.users u
SET
  raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('org_id', pm.org_id::text),
  raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'onboarding_completed', true,
      'invited', COALESCE((u.raw_user_meta_data->>'invited')::boolean, false)
        OR EXISTS (
          SELECT 1 FROM invitations i
          WHERE lower(i.email) = lower(u.email)
        )
    ),
  updated_at = now()
FROM primary_membership pm
WHERE pm.user_id = u.id
  AND (
    (u.raw_app_meta_data->>'org_id') IS NULL
    OR (u.raw_app_meta_data->>'org_id') = ''
    OR (
      EXISTS (
        SELECT 1 FROM invitations i WHERE lower(i.email) = lower(u.email)
      )
      AND COALESCE((u.raw_user_meta_data->>'onboarding_completed')::boolean, false) IS NOT TRUE
    )
  );

-- Explicitly mark invitation recipients as invited + onboarding complete
UPDATE auth.users u
SET
  raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'invited', true,
      'onboarding_completed', true,
      'invitation_password_confirmed', true
    ),
  updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM invitations i WHERE lower(i.email) = lower(u.email)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. accept_invitation — also stamp app_metadata.org_id for future invites
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation invitations%ROWTYPE;
  v_user_id uuid;
  v_member_id uuid;
  v_property_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invitation_not_found');
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE invitations SET status = 'expired', updated_at = now()
    WHERE id = v_invitation.id;
    RETURN jsonb_build_object('error', 'invitation_expired');
  END IF;

  IF lower((SELECT email FROM auth.users WHERE id = v_user_id)) != lower(v_invitation.email) THEN
    RETURN jsonb_build_object('error', 'email_mismatch');
  END IF;

  IF EXISTS (
    SELECT 1 FROM organisation_members
    WHERE org_id = v_invitation.org_id
      AND user_id = v_user_id
  ) THEN
    UPDATE invitations
    SET status = 'accepted', accepted_at = now(), updated_at = now()
    WHERE id = v_invitation.id;

    UPDATE auth.users
    SET
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('org_id', v_invitation.org_id::text),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object(
          'invited', true,
          'onboarding_completed', true,
          'invitation_password_confirmed', true
        ),
      updated_at = now()
    WHERE id = v_user_id;

    PERFORM seed_staff_training_tasks(
      v_invitation.org_id,
      v_user_id,
      CASE WHEN v_invitation.property_ids IS NOT NULL AND array_length(v_invitation.property_ids, 1) > 0
        THEN v_invitation.property_ids[1] ELSE NULL END
    );
    RETURN jsonb_build_object('org_id', v_invitation.org_id, 'already_member', true);
  END IF;

  INSERT INTO organisation_members (org_id, user_id, role, assigned_properties)
  VALUES (
    v_invitation.org_id,
    v_user_id,
    COALESCE(v_invitation.role, 'member'),
    v_invitation.property_ids
  )
  RETURNING id INTO v_member_id;

  UPDATE invitations
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = v_invitation.id;

  UPDATE auth.users
  SET
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('org_id', v_invitation.org_id::text),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'invited', true,
        'onboarding_completed', true,
        'invitation_password_confirmed', true
      ),
    updated_at = now()
  WHERE id = v_user_id;

  v_property_id := CASE
    WHEN v_invitation.property_ids IS NOT NULL AND array_length(v_invitation.property_ids, 1) > 0
    THEN v_invitation.property_ids[1]
    ELSE NULL
  END;

  PERFORM seed_staff_training_tasks(v_invitation.org_id, v_user_id, v_property_id);

  RETURN jsonb_build_object(
    'org_id', v_invitation.org_id,
    'member_id', v_member_id,
    'role', v_invitation.role,
    'property_ids', v_invitation.property_ids
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invitation(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
