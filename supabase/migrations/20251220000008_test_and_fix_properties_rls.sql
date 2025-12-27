-- TEST: First verify the membership exists
-- Run this query to check if the user is a member of the org
-- Replace the UUIDs with your actual user_id and org_id from the error

-- Example (replace with your actual IDs):
-- SELECT * FROM organisation_members 
-- WHERE user_id = '27e521f6-34fa-46ff-b6e4-05c67f6438cd' 
-- AND org_id = '79ab01db-be8a-4f88-87aa-f7ed99db4df8';

-- ============================================
-- FIX: Drop ALL existing policies and recreate
-- ============================================

-- Drop all existing INSERT policies on properties
DROP POLICY IF EXISTS "properties_insert" ON properties;

-- Create a new policy that directly checks membership
-- This uses a subquery that should work with the organisation_members SELECT policy
CREATE POLICY "properties_insert" ON properties
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

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'properties' 
  AND policyname = 'properties_insert';

