-- Fix Auto Onboarding Trigger: Add error handling and ensure it works
-- This ensures the trigger doesn't fail silently and handles edge cases

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

  BEGIN
    -- Action 1: Create a personal organisation for the new user
    INSERT INTO organisations (name, org_type, created_by)
    VALUES ('My Personal Org', 'personal', NEW.id)
    RETURNING id INTO new_org_id;

    -- Action 2: Create organisation membership with owner role
    INSERT INTO organisation_members (user_id, org_id, role)
    VALUES (NEW.id, new_org_id, 'owner');

    -- Log success (for debugging)
    RAISE NOTICE 'Created personal org % for user %', new_org_id, NEW.id;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the user creation
      -- This allows the user to be created even if org creation fails
      RAISE WARNING 'Failed to create personal org for user %: %', NEW.id, SQLERRM;
      -- Return NEW anyway so user creation succeeds
  END;

  RETURN NEW;
END;
$$;

