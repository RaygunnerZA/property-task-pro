-- Alternative approach: Use direct membership check instead of function
-- This bypasses any potential function execution issues

-- ============================================================================
-- STEP 1: Drop existing policy
-- ============================================================================

DROP POLICY IF EXISTS "attachments_insert" ON attachments;

-- ============================================================================
-- STEP 2: Create policy with direct membership check
-- ============================================================================
-- This uses a subquery directly in the policy instead of a function
-- Sometimes this is more reliable than function calls

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

-- ============================================================================
-- STEP 3: Verify policy was created
-- ============================================================================

DO $$
DECLARE
  policy_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attachments' 
    AND policyname = 'attachments_insert'
    AND cmd = 'INSERT'
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    RAISE EXCEPTION 'Policy attachments_insert was not created';
  END IF;
  
  RAISE NOTICE 'Successfully created attachments_insert policy with direct membership check';
END $$;

