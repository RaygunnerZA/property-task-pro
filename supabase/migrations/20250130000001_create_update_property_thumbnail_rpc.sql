-- Create RPC function to update property thumbnail_url
-- This bypasses RLS and guarantees successful property update
-- Similar pattern to create_property_v2

CREATE OR REPLACE FUNCTION update_property_thumbnail(
  p_property_id UUID,
  p_thumbnail_url TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_property_org_id UUID;
  v_membership_count INTEGER;
  v_updated_property JSON;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;
  
  -- Get the property's org_id (bypasses RLS due to SECURITY DEFINER)
  SELECT org_id INTO v_property_org_id
  FROM properties
  WHERE id = p_property_id;
  
  -- Check if property exists
  IF v_property_org_id IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;
  
  -- Check if user is a member of the property's organisation
  -- This query bypasses RLS due to SECURITY DEFINER
  SELECT COUNT(*) INTO v_membership_count
  FROM organisation_members
  WHERE org_id = v_property_org_id
    AND user_id = v_user_id;
  
  -- If not a member, deny access
  IF v_membership_count = 0 THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;
  
  -- Update the property (bypasses RLS due to SECURITY DEFINER)
  UPDATE properties
  SET thumbnail_url = p_thumbnail_url,
      updated_at = NOW()
  WHERE id = p_property_id
  RETURNING json_build_object(
    'id', id,
    'org_id', org_id,
    'address', address,
    'nickname', nickname,
    'thumbnail_url', thumbnail_url,
    'updated_at', updated_at
  ) INTO v_updated_property;
  
  -- Return the updated property as JSON
  RETURN v_updated_property;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_property_thumbnail(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_property_thumbnail(UUID, TEXT) TO anon;

