-- Ensure invitations table and acceptance RPCs exist on remote (migration may be recorded but table missing).

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  property_ids UUID[] DEFAULT NULL,
  team_ids UUID[] DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS property_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS team_ids UUID[] DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invitations_org_email ON invitations(org_id, email);

CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_invitation
  ON invitations(org_id, email)
  WHERE status = 'pending';

DROP POLICY IF EXISTS "Users can view invitations in their org" ON invitations;
CREATE POLICY "Users can view invitations in their org"
ON invitations FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view their own pending invitations" ON invitations;
CREATE POLICY "Users can view their own pending invitations"
ON invitations FOR SELECT
TO authenticated
USING (
  status = 'pending'
  AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Public can view invitations by token" ON invitations;
CREATE POLICY "Public can view invitations by token"
ON invitations FOR SELECT
TO anon, authenticated
USING (
  status = 'pending'
  AND token IS NOT NULL
  AND expires_at > NOW()
);

DROP POLICY IF EXISTS "Users can create invitations in their org" ON invitations;
CREATE POLICY "Users can create invitations in their org"
ON invitations FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT org_id FROM organisation_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
  )
);

DROP POLICY IF EXISTS "Users can update invitations in their org" ON invitations;
CREATE POLICY "Users can update invitations in their org"
ON invitations FOR UPDATE
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  org_id IN (
    SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners and managers can delete invitations in their org" ON invitations;
CREATE POLICY "Owners and managers can delete invitations in their org"
ON invitations FOR DELETE
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM organisation_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
  )
);

CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE invitations
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$;

CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  token TEXT;
BEGIN
  token := encode(gen_random_bytes(24), 'base64url');
  RETURN token;
END;
$$;

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

  RETURN jsonb_build_object(
    'org_id', v_invitation.org_id,
    'member_id', v_member_id,
    'role', v_invitation.role,
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
  FROM invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_invitation.id,
    'org_id', v_invitation.org_id,
    'email', v_invitation.email,
    'first_name', v_invitation.first_name,
    'last_name', v_invitation.last_name,
    'role', v_invitation.role,
    'expires_at', v_invitation.expires_at,
    'token', v_invitation.token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_invitation_by_token(text) TO anon, authenticated;
