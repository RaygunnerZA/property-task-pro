-- Auto Onboarding: Create Personal Org for New Users
-- Source of Truth: @Docs/02_Identity.md (Invisible Org)

-- ============================================================================
-- FUNCTION: Handle New User Onboarding
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
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

-- ============================================================================
-- TRIGGER: Auto-create org on user signup
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

