-- Fix INSERT policies for properties, assets, and tasks tables
-- Uses SECURITY DEFINER function to bypass RLS when checking membership

-- ============================================================================
-- HELPER FUNCTION: Check if user is a member of an org
-- ============================================================================
-- This function bypasses RLS by running as postgres user (SECURITY DEFINER)
-- This ensures membership checks work even during onboarding when JWT might not be fully set

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
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  -- Return false if no user
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if membership exists (bypasses RLS due to SECURITY DEFINER)
  SELECT COUNT(*) INTO v_count
  FROM organisation_members
  WHERE org_id = p_org_id
    AND user_id = v_user_id;
  
  RETURN v_count > 0;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_org_membership(UUID) TO anon;

-- ============================================================================
-- PROPERTIES: INSERT Policy
-- ============================================================================
-- Allow authenticated users to insert properties if they are members of the org

DROP POLICY IF EXISTS "properties_insert" ON properties;

CREATE POLICY "properties_insert" ON properties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

-- ============================================================================
-- ASSETS: INSERT Policy
-- ============================================================================
-- Allow authenticated users to insert assets if they are members of the org

DROP POLICY IF EXISTS "assets_insert" ON assets;

CREATE POLICY "assets_insert" ON assets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

-- ============================================================================
-- TASKS: INSERT Policy
-- ============================================================================
-- Allow authenticated users to insert tasks if they are members of the org

DROP POLICY IF EXISTS "tasks_insert" ON tasks;

CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND check_user_org_membership(org_id) = TRUE
  );

