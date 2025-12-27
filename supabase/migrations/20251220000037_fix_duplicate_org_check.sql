-- Fix duplicate org name check to be more lenient and handle auto-created orgs
-- The issue is that users might have an auto-created "My Personal Org" and want to create a business org
-- We should allow multiple orgs with different types, or allow renaming the auto-created one

-- ============================================================================
-- UPDATE: check_duplicate_org_name function
-- ============================================================================
-- Make it more lenient - only check for exact matches including org_type
-- OR allow users to have one personal org and multiple business orgs
CREATE OR REPLACE FUNCTION check_duplicate_org_name(
  p_org_name TEXT,
  p_user_id UUID,
  p_org_type org_type DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_personal_count INTEGER;
BEGIN
  -- If org_type is 'personal', only allow one personal org per user
  IF p_org_type = 'personal' THEN
    SELECT COUNT(*) INTO v_personal_count
    FROM organisations
    WHERE created_by = p_user_id
      AND org_type = 'personal'
    
    -- If user already has a personal org, it's a duplicate
    IF v_personal_count > 0 THEN
      RETURN TRUE
    END IF
  END IF
  
  -- For business orgs, check for exact name match (case-insensitive)
  -- Allow multiple business orgs with different names
  SELECT COUNT(*) INTO v_count
  FROM organisations
  WHERE created_by = p_user_id
    AND LOWER(TRIM(name)) = LOWER(TRIM(p_org_name))
    AND (p_org_type IS NULL OR org_type = p_org_type)
  
  RETURN v_count > 0
END
$$;

-- Update the create_organisation function to pass org_type to the duplicate check
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
  -- Check for duplicate org name (now includes org_type in check)
  has_duplicate := check_duplicate_org_name(org_name, creator_id, org_type_value);
  
  IF has_duplicate THEN
    -- Provide more helpful error message
    IF org_type_value = 'personal' THEN
      RAISE EXCEPTION 'You already have a personal organisation. You can only have one personal organisation.'
    ELSE
      RAISE EXCEPTION 'An organisation with this name already exists. Please choose a different name.'
    END IF
  END IF

  -- Temporarily disable RLS for this function
  SET LOCAL row_security = off

  -- Insert the organisation
  INSERT INTO organisations (name, org_type, created_by)
  VALUES (org_name, org_type_value, creator_id)
  RETURNING id INTO new_org_id

  -- Also create the membership with owner role
  -- This happens atomically, bypassing RLS
  INSERT INTO organisation_members (user_id, org_id, role)
  VALUES (creator_id, new_org_id, 'owner')

  RETURN new_org_id
END
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_duplicate_org_name(TEXT, UUID, org_type) TO authenticated;

