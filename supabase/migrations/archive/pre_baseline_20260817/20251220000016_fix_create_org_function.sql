-- Fix create_organisation function to also create the membership
-- This ensures org creation and membership creation happen atomically
-- and bypasses RLS issues

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
BEGIN
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_organisation(TEXT, org_type, UUID) TO authenticated;

