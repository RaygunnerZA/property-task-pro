-- Create RPC function for property creation with SECURITY DEFINER
-- This bypasses RLS and guarantees successful property creation

-- ============================================================================
-- FUNCTION: create_property_v2
-- ============================================================================
-- Purpose: Create a property with membership verification
-- Security: SECURITY DEFINER (runs with postgres privileges, bypasses RLS)
-- Inputs:
--   p_org_id: UUID of the organisation
--   p_address: TEXT address of the property
-- Returns: JSON object of the created property row

CREATE OR REPLACE FUNCTION create_property_v2(
  p_org_id UUID,
  p_address TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_membership_count INTEGER;
  v_new_property JSON;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;
  
  -- Check if user is a member of the organisation
  -- This query bypasses RLS due to SECURITY DEFINER
  SELECT COUNT(*) INTO v_membership_count
  FROM organisation_members
  WHERE org_id = p_org_id
    AND user_id = v_user_id;
  
  -- If not a member, deny access
  IF v_membership_count = 0 THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Insert the property (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO properties (org_id, address)
  VALUES (p_org_id, p_address)
  RETURNING json_build_object(
    'id', id,
    'org_id', org_id,
    'address', address,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_new_property;
  
  -- Return the new property as JSON
  RETURN v_new_property;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_property_v2(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_property_v2(UUID, TEXT) TO anon;

