-- Add duplicate validation for organisations and properties
-- Prevents users from creating duplicate org names (within their own orgs)
-- Prevents duplicate property addresses within the same org

-- ============================================================================
-- FUNCTION: Check duplicate org name for user
-- ============================================================================
CREATE OR REPLACE FUNCTION check_duplicate_org_name(
  p_org_name TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check if user already has an org with this name
  SELECT COUNT(*) INTO v_count
  FROM organisations
  WHERE created_by = p_user_id
    AND LOWER(TRIM(name)) = LOWER(TRIM(p_org_name));
  
  RETURN v_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION check_duplicate_org_name(TEXT, UUID) TO authenticated;

-- ============================================================================
-- FUNCTION: Check duplicate property address in org
-- ============================================================================
CREATE OR REPLACE FUNCTION check_duplicate_property_address(
  p_org_id UUID,
  p_address TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check if org already has a property with this address
  SELECT COUNT(*) INTO v_count
  FROM properties
  WHERE org_id = p_org_id
    AND LOWER(TRIM(address)) = LOWER(TRIM(p_address));
  
  RETURN v_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION check_duplicate_property_address(UUID, TEXT) TO authenticated;

-- ============================================================================
-- UPDATE: create_organisation function to check for duplicates
-- ============================================================================
CREATE OR REPLACE FUNCTION create_organisation(
  org_name TEXT,
  org_type_value org_type,
  creator_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  has_duplicate BOOLEAN;
BEGIN
  -- Check for duplicate org name
  has_duplicate := check_duplicate_org_name(org_name, creator_id);
  
  IF has_duplicate THEN
    RAISE EXCEPTION 'An organisation with this name already exists. Please choose a different name.';
  END IF;

  -- Temporarily disable RLS for this function
  SET LOCAL row_security = off;

  -- Insert the organisation
  INSERT INTO organisations (name, org_type, created_by)
  VALUES (org_name, org_type_value, creator_id)
  RETURNING id INTO new_org_id;

  -- Also create the membership with owner role
  -- This happens atomically, bypassing RLS
  INSERT INTO organisation_members (user_id, org_id, role)
  VALUES (creator_id, new_org_id, 'owner');

  RETURN new_org_id;
END;
$$;

-- ============================================================================
-- UPDATE: create_property_v2 function to check for duplicates
-- ============================================================================
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

