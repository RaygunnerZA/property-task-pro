-- STEP 1: Verify membership exists (run this first to test)
-- Replace with your actual user_id and org_id from the error
SELECT 
  om.id,
  om.org_id,
  om.user_id,
  om.role,
  o.name as org_name
FROM organisation_members om
JOIN organisations o ON o.id = om.org_id
WHERE om.user_id = 'e9ca0190-88b2-43bf-a651-585a84d0717e'  -- Your user_id
  AND om.org_id = 'ec4545a7-b540-4b8f-8cbc-d91699766210';  -- Your org_id

-- If the above returns a row, membership exists. Continue to Step 2.
-- If it returns no rows, the membership doesn't exist and that's the problem.

-- ============================================
-- STEP 2: Fix the RLS policy
-- ============================================

-- Create function that bypasses RLS
CREATE OR REPLACE FUNCTION check_user_org_membership(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM organisation_members
  WHERE org_id = p_org_id AND user_id = v_user_id;
  RETURN v_count > 0;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO anon;

-- Drop old policy
DROP POLICY IF EXISTS "properties_insert" ON properties;

-- Create new policy
CREATE POLICY "properties_insert" ON properties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

-- Verify
SELECT 'SUCCESS: Policy created' as status, policyname 
FROM pg_policies 
WHERE tablename = 'properties' AND policyname = 'properties_insert';

