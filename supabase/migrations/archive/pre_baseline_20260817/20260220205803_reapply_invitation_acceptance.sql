-- Re-apply invitation acceptance fix (original migration may not have executed)

ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS property_ids uuid[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS team_ids     uuid[] DEFAULT NULL;

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
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO v_invitation
  FROM   invitations
  WHERE  token  = p_token
    AND  status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'invitation_not_found');
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE invitations SET status = 'expired', updated_at = now()
    WHERE  id = v_invitation.id;
    RETURN jsonb_build_object('error', 'invitation_expired');
  END IF;

  IF lower((SELECT email FROM auth.users WHERE id = v_user_id)) != lower(v_invitation.email) THEN
    RETURN jsonb_build_object('error', 'email_mismatch');
  END IF;

  IF EXISTS (
    SELECT 1 FROM organisation_members
    WHERE  org_id   = v_invitation.org_id
      AND  user_id  = v_user_id
  ) THEN
    UPDATE invitations
       SET status = 'accepted', accepted_at = now(), updated_at = now()
    WHERE  id = v_invitation.id;
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
  WHERE  id = v_invitation.id;

  RETURN jsonb_build_object(
    'org_id',       v_invitation.org_id,
    'member_id',    v_member_id,
    'role',         v_invitation.role,
    'property_ids', v_invitation.property_ids
  );
END;
$$;

GRANT EXECUTE ON FUNCTION accept_invitation(text) TO authenticated;

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
