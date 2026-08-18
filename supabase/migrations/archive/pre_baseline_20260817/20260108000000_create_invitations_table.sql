-- Create invitations table for team member invitations
-- Tracks pending invitations before users accept and join organisations

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'member', -- owner, manager, member, staff
  invited_by UUID NOT NULL, -- References auth.users(id)
  token TEXT NOT NULL UNIQUE, -- Unique token for invitation link
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, expired, cancelled
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invitations_org_email ON invitations(org_id, email);

-- Prevent duplicate pending invitations for same email+org using partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_invitation 
ON invitations(org_id, email) 
WHERE status = 'pending';

-- RLS Policies for invitations
-- Users can view invitations for their organisations
DROP POLICY IF EXISTS "Users can view invitations in their org" ON invitations;
CREATE POLICY "Users can view invitations in their org"
ON invitations FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
  )
);

-- Users can view their own pending invitations (by email) even if not in org yet
-- This allows them to accept invitations
DROP POLICY IF EXISTS "Users can view their own pending invitations" ON invitations;
CREATE POLICY "Users can view their own pending invitations"
ON invitations FOR SELECT
TO authenticated
USING (
  status = 'pending' 
  AND email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Users can create invitations for their organisations (if they're managers or owners)
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

-- Users can update invitations they created or in their org (for cancelling)
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

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE invitations
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending'
  AND expires_at < now();
END;
$$;

-- Function to generate a unique invitation token
CREATE OR REPLACE FUNCTION generate_invitation_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  token TEXT;
BEGIN
  -- Generate a secure random token (32 characters)
  token := encode(gen_random_bytes(24), 'base64url');
  RETURN token;
END;
$$;
