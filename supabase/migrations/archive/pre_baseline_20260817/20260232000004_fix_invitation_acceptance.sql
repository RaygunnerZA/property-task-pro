-- Fix invitation acceptance flow
--
-- Problems fixed:
--   1. property_ids from InviteUserModal were lost (no column on invitations table)
--   2. The acceptance flow was non-atomic (separate INSERTs/UPDATEs could be blocked by RLS)
--   3. team_ids from the invite were not stored
--   4. The accepter could not UPDATE the invitation to 'accepted' if
--      the org_id check ran before the member INSERT was committed
--
-- Solution:
--   a. Add property_ids + team_ids columns to invitations
--   b. Create accept_invitation() SECURITY DEFINER RPC that atomically:
--        - Validates the invitation (token match, not expired, pending)
--        - Inserts into organisation_members with assigned_properties
--        - Marks the invitation accepted
--        - Returns the org_id so the client can navigate to the correct org

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend invitations table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS property_ids uuid[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS team_ids     uuid[] DEFAULT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. accept_invitation RPC
--
-- Called from AcceptInvitation.tsx after the user is authenticated.
-- SECURITY DEFINER bypasses RLS so we can:
--   - Read the invitation (even if the "view org invitations" policy would block)
--   - Insert the org member row
--   - Update the invitation status
-- Returns the org_id on success so the frontend can route to the correct org.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation  invitations%ROWTYPE;
  v_user_id     uuid;
  v_member_id   uuid;
BEGIN
  -- Identify the calling user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- Look up the invitation by token
  SELECT * INTO v_invitation
  FROM   invitations
  WHERE  token  = p_token
    AND  status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invitation_not_found');
  END IF;

  -- Check expiry
  IF v_invitation.expires_at < now() THEN
    UPDATE invitations SET status = 'expired', updated_at = now()
    WHERE  id = v_invitation.id;
    RETURN jsonb_build_object('error', 'invitation_expired');
  END IF;

  -- Check the user's email matches the invitation email (case-insensitive)
  IF lower((SELECT email FROM auth.users WHERE id = v_user_id)) != lower(v_invitation.email) THEN
    RETURN jsonb_build_object('error', 'email_mismatch');
  END IF;

  -- Already a member? Still mark accepted and return success
  IF EXISTS (
    SELECT 1 FROM organisation_members
    WHERE  org_id   = v_invitation.org_id
      AND  user_id  = v_user_id
  ) THEN
    UPDATE invitations
       SET status      = 'accepted',
           accepted_at = now(),
           updated_at  = now()
    WHERE  id = v_invitation.id;
    RETURN jsonb_build_object('org_id', v_invitation.org_id, 'already_member', true);
  END IF;

  -- Insert org member
  INSERT INTO organisation_members (org_id, user_id, role, assigned_properties)
  VALUES (
    v_invitation.org_id,
    v_user_id,
    COALESCE(v_invitation.role, 'member'),
    v_invitation.property_ids   -- NULL for "all properties" access
  )
  RETURNING id INTO v_member_id;

  -- Mark invitation accepted
  UPDATE invitations
     SET status      = 'accepted',
         accepted_at = now(),
         updated_at  = now()
  WHERE  id = v_invitation.id;

  RETURN jsonb_build_object(
    'org_id',     v_invitation.org_id,
    'member_id',  v_member_id,
    'role',       v_invitation.role,
    'property_ids', v_invitation.property_ids
  );
END;
$$;

-- Allow any authenticated user to call this function
GRANT EXECUTE ON FUNCTION accept_invitation(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. find_invitation_by_token — public read (token is the secret)
--    Replaces the broad "Public can view invitations by token" policy with
--    a tighter function that returns only the fields the UI needs.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_invitation
  FROM   invitations
  WHERE  token      = p_token
    AND  status     = 'pending'
    AND  expires_at > now();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id',         v_invitation.id,
    'org_id',     v_invitation.org_id,
    'email',      v_invitation.email,
    'first_name', v_invitation.first_name,
    'last_name',  v_invitation.last_name,
    'role',       v_invitation.role,
    'expires_at', v_invitation.expires_at,
    'token',      v_invitation.token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_invitation_by_token(text) TO anon, authenticated;
