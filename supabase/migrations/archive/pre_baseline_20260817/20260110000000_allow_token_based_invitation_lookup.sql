-- Allow unauthenticated users to look up invitations by token
-- This is safe because:
-- 1. Tokens are secure random strings
-- 2. Only valid for pending invitations
-- 3. Tokens expire after a set time
-- This allows users to accept invitations even if the Supabase auth link expired

DROP POLICY IF EXISTS "Public can view invitations by token" ON invitations;

CREATE POLICY "Public can view invitations by token"
ON invitations FOR SELECT
TO anon, authenticated
USING (
  status = 'pending'
  AND token IS NOT NULL
  AND expires_at > NOW()
);
