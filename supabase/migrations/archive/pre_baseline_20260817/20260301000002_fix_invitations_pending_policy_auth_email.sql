-- Fix "permission denied for table users" when selecting invitations.
-- Root cause: this policy queried auth.users directly, which is not readable by
-- standard authenticated clients in all environments.
-- Use auth.email()/auth.jwt() instead to avoid direct table access.

DROP POLICY IF EXISTS "Users can view their own pending invitations" ON invitations;

CREATE POLICY "Users can view their own pending invitations"
ON invitations
FOR SELECT
TO authenticated
USING (
  status = 'pending'
  AND lower(email) = lower(
    COALESCE(
      auth.email(),
      auth.jwt() ->> 'email',
      ''
    )
  )
);
