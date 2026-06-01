-- Final fix: Use direct EXISTS check with proper table alias
-- This should work reliably for INSERT operations

DROP POLICY IF EXISTS "attachments_insert" ON attachments;

CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM organisation_members om
      WHERE om.org_id = attachments.org_id
        AND om.user_id = auth.uid()
    )
  );

-- Verify
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attachments' 
    AND policyname = 'attachments_insert'
    AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'Policy was not created';
  END IF;
  RAISE NOTICE 'attachments_insert policy created successfully';
END $$;

