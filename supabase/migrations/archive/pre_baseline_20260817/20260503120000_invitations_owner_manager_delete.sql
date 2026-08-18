-- Allow owners and managers to remove invitation rows (same privilege as creating invites).
-- Cancelling from Settings uses PostgREST delete so it does not depend on Edge Functions being reachable.

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
