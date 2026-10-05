-- Creating an organisation inserted the owner more than once:
-- on_org_created and trg_new_org both call handle_new_organisation, and
-- create_organisation inserts organisation_members again. The second insert
-- hits organisation_members_org_user_unique and the RPC returns 409.
-- Keep a single trigger, and make both writers idempotent so the creator
-- is still the Primary Owner.

DROP TRIGGER IF EXISTS trg_new_org ON public.organisations;

CREATE OR REPLACE FUNCTION public.handle_new_organisation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  -- Migrations / service role / sentinel platform org: no membership bootstrap.
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.organisation_members (org_id, user_id, role, is_primary_owner)
  VALUES (NEW.id, uid, 'owner', true)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('org_id', NEW.id)
  WHERE id = uid;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_organisation(
  org_name text,
  org_type_value public.org_type,
  creator_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_org_id UUID;
  has_duplicate BOOLEAN;
  actor_id UUID;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NOT NULL AND creator_id IS DISTINCT FROM actor_id THEN
    RAISE EXCEPTION 'Access Denied: creator must be the signed-in user';
  END IF;

  has_duplicate := check_duplicate_org_name(org_name, creator_id, org_type_value);

  IF has_duplicate THEN
    IF org_type_value = 'personal' THEN
      RAISE EXCEPTION 'You already have a personal organisation. You can only have one personal organisation.';
    ELSE
      RAISE EXCEPTION 'An organisation with this name already exists. Please choose a different name.';
    END IF;
  END IF;

  SET LOCAL row_security = off;

  INSERT INTO organisations (name, org_type, created_by)
  VALUES (org_name, org_type_value, creator_id)
  RETURNING id INTO new_org_id;

  -- The org insert trigger may already have added this owner.
  INSERT INTO organisation_members (user_id, org_id, role, is_primary_owner)
  VALUES (creator_id, new_org_id, 'owner', true)
  ON CONFLICT (org_id, user_id) DO UPDATE
  SET
    role = 'owner',
    is_primary_owner = true,
    membership_status = 'active'
  WHERE organisation_members.is_primary_owner = false
     OR lower(organisation_members.role) IS DISTINCT FROM 'owner';

  RETURN new_org_id;
END;
$$;
