-- Pending-invitation SELECT queried auth.users directly.
-- Authenticated clients cannot read that table, so the policy error
-- fails the whole invitations query — including for owners and admins
-- who are already organisation members.
-- Visibility stays the same: pending rows whose email matches the session.

DROP POLICY IF EXISTS "Users can view their own pending invitations" ON public.invitations;

CREATE POLICY "Users can view their own pending invitations"
ON public.invitations
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
