-- Try direct subquery approach for attachments INSERT RLS
-- This matches a pattern that worked for properties in earlier migrations
-- Uses a subquery that should work with the organisation_members SELECT policy

-- Drop existing policy
DROP POLICY IF EXISTS "attachments_insert" ON attachments;

-- Create policy using direct subquery (same pattern as properties_insert in 20251220000008)
CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id 
      FROM organisation_members
      WHERE user_id = auth.uid()
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
    RAISE EXCEPTION 'Policy attachments_insert was not created';
  END IF;
  RAISE NOTICE 'attachments_insert policy created with direct subquery';
END $$;

