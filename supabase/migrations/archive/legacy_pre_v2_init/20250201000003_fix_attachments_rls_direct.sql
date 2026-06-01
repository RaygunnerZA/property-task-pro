-- Fix attachments INSERT RLS policy using direct membership check
-- This matches the pattern used successfully in other tables

-- ============================================================================
-- STEP 1: Drop existing policy
-- ============================================================================
DROP POLICY IF EXISTS "attachments_insert" ON attachments;

-- ============================================================================
-- STEP 2: Create policy using direct membership check (same as properties/assets/tasks)
-- ============================================================================
CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM organisation_members
      WHERE organisation_members.org_id = org_id
        AND organisation_members.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 3: Verify the policy was created
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attachments'
      AND policyname = 'attachments_insert'
  ) THEN
    RAISE EXCEPTION 'Policy attachments_insert was not created';
  END IF;
END $$;

