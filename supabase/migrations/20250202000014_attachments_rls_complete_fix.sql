-- Complete fix: Ensure both SELECT and INSERT policies exist
-- Some RLS setups require SELECT policy even for INSERT operations
-- This ensures the user can both insert and read the inserted row

-- First, ensure SELECT policy exists
DROP POLICY IF EXISTS "attachments_select" ON attachments;

CREATE POLICY "attachments_select" ON attachments
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

-- Ensure INSERT policy exists and is simple
DROP POLICY IF EXISTS "attachments_insert" ON attachments;

CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Verify both policies
DO $$
DECLARE
  v_select_count INTEGER;
  v_insert_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_select_count
  FROM pg_policies
  WHERE tablename = 'attachments'
    AND cmd = 'SELECT';
  
  SELECT COUNT(*) INTO v_insert_count
  FROM pg_policies
  WHERE tablename = 'attachments'
    AND cmd = 'INSERT';
  
  RAISE NOTICE 'attachments policies: % SELECT, % INSERT', v_select_count, v_insert_count;
  
  IF v_insert_count = 0 THEN
    RAISE EXCEPTION 'No INSERT policy found';
  END IF;
END $$;

