-- Fix Auto Onboarding: Bypass RLS in trigger function
-- The trigger function needs to insert into organisations and organisation_members
-- but RLS policies block inserts. We need to temporarily disable RLS.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Temporarily disable RLS for this function execution
  -- This allows the trigger to insert even though the new user doesn't have JWT yet
  SET LOCAL row_security = off;

  -- Action 1: Create a personal organisation for the new user
  INSERT INTO organisations (name, org_type, created_by)
  VALUES ('My Personal Org', 'personal', NEW.id)
  RETURNING id INTO new_org_id;

  -- Action 2: Create organisation membership with owner role
  INSERT INTO organisation_members (user_id, org_id, role)
  VALUES (NEW.id, new_org_id, 'owner');

  RETURN NEW;
END;
$$;

