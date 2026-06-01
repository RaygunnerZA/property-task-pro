-- Fix attachments INSERT RLS using auth.uid() check instead of auth.role()
-- This is more direct and should work reliably

-- Drop ALL existing INSERT policies
DROP POLICY IF EXISTS "attachments_insert" ON attachments;
DROP POLICY IF EXISTS "attachments_insert_auth" ON attachments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON attachments;
DROP POLICY IF EXISTS "attachments_insert_policy" ON attachments;
DROP POLICY IF EXISTS "allow_attachments_insert" ON attachments;

-- Create policy using auth.uid() check (more direct than auth.role())
CREATE POLICY "attachments_insert" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Verify and log all policies
DO $$
DECLARE
  v_policy_count INTEGER;
  v_policy_rec RECORD;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'attachments'
    AND cmd = 'INSERT';
  
  RAISE NOTICE 'Found % INSERT policies on attachments', v_policy_count;
  
  FOR v_policy_rec IN
    SELECT policyname, cmd, with_check
    FROM pg_policies
    WHERE tablename = 'attachments'
      AND cmd = 'INSERT'
  LOOP
    RAISE NOTICE 'Policy: %, With Check: %', v_policy_rec.policyname, v_policy_rec.with_check;
  END LOOP;
  
  IF v_policy_count = 0 THEN
    RAISE EXCEPTION 'No INSERT policy found on attachments table';
  END IF;
END $$;

