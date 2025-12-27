-- Enhance create_property_v2 function to support nickname, icon, color, and thumbnail
-- This allows the property creation dialog to match the onboarding screen functionality

CREATE OR REPLACE FUNCTION create_property_v2(
  p_org_id UUID,
  p_address TEXT,
  p_nickname TEXT DEFAULT NULL,
  p_icon_name TEXT DEFAULT NULL,
  p_icon_color_hex TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL
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
  has_duplicate BOOLEAN;
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
  
  -- Check for duplicate property address
  has_duplicate := check_duplicate_property_address(p_org_id, p_address);
  
  IF has_duplicate THEN
    RAISE EXCEPTION 'A property with this address already exists in your organisation. Please use a different address.';
  END IF;
  
  -- Insert the property with all optional fields (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO properties (
    org_id, 
    address, 
    nickname, 
    icon_name, 
    icon_color_hex, 
    thumbnail_url
  )
  VALUES (
    p_org_id, 
    p_address,
    p_nickname,
    p_icon_name,
    p_icon_color_hex,
    p_thumbnail_url
  )
  RETURNING json_build_object(
    'id', id,
    'org_id', org_id,
    'address', address,
    'nickname', nickname,
    'icon_name', icon_name,
    'icon_color_hex', icon_color_hex,
    'thumbnail_url', thumbnail_url,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_new_property;
  
  -- Return the new property as JSON
  RETURN v_new_property;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_property_v2(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_property_v2(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

