-- Backfill missing organisations for users who don't have one
-- This fixes the issue where existing users don't have orgs

-- ============================================================================
-- FUNCTION: Ensure user has an organisation
-- ============================================================================
-- Creates a personal org for users who don't have one

CREATE OR REPLACE FUNCTION ensure_user_has_org(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_existing_org_id UUID;
BEGIN
  -- Check if user already has an org
  SELECT org_id INTO v_existing_org_id
  FROM organisation_members
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If they already have an org, return it
  IF v_existing_org_id IS NOT NULL THEN
    RETURN v_existing_org_id;
  END IF;
  
  -- Create a personal organisation for the user
  INSERT INTO organisations (name, org_type, created_by)
  VALUES ('My Personal Org', 'personal', p_user_id)
  RETURNING id INTO v_org_id;
  
  -- Create organisation membership with owner role
  INSERT INTO organisation_members (user_id, org_id, role)
  VALUES (p_user_id, v_org_id, 'owner');
  
  RETURN v_org_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION ensure_user_has_org(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_user_has_org(UUID) TO anon;

-- ============================================================================
-- BACKFILL: Create orgs for existing users who don't have one
-- ============================================================================
-- This runs once to fix existing users

DO $$
DECLARE
  v_user RECORD;
  v_org_id UUID;
  v_has_org BOOLEAN;
BEGIN
  -- Loop through all users in auth.users
  FOR v_user IN 
    SELECT id FROM auth.users
  LOOP
    -- Check if user has an org
    SELECT EXISTS (
      SELECT 1 FROM organisation_members
      WHERE user_id = v_user.id
    ) INTO v_has_org;
    
    -- If no org, create one
    IF NOT v_has_org THEN
      BEGIN
        v_org_id := ensure_user_has_org(v_user.id);
        RAISE NOTICE 'Created org % for user %', v_org_id, v_user.id;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Failed to create org for user %: %', v_user.id, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

