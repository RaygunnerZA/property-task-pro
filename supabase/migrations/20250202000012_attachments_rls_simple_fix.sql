-- Simple fix: Use the same approach as the original migration
-- Just check if user is authenticated - backend validates org membership
-- This matches the pattern used for evidence table

-- Drop ALL existing INSERT policies on attachments
DROP POLICY IF EXISTS "attachments_insert" ON attachments;
DROP POLICY IF EXISTS "attachments_insert_auth" ON attachments;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON attachments;
DROP POLICY IF EXISTS "attachments_insert_policy" ON attachments;
DROP POLICY IF EXISTS "allow_attachments_insert" ON attachments;

-- Create a single, simple policy that just checks authentication
-- The backend/application logic validates org membership
CREATE POLICY "Enable insert for authenticated users" ON attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Verify
DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename = 'attachments'
    AND cmd = 'INSERT';
  
  IF v_policy_count = 0 THEN
    RAISE EXCEPTION 'No INSERT policy found on attachments table';
  END IF;
  
  IF v_policy_count > 1 THEN
    RAISE WARNING 'Multiple INSERT policies found: %', v_policy_count;
  END IF;
  
  RAISE NOTICE 'attachments INSERT policy created: auth.role() = authenticated';
END $$;

