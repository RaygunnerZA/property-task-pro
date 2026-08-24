-- Ensure constitutional sentinel org for platform-scoped audit_logs (Ch 3).
-- Without this row, admin RPCs that log with org_id = 000…000 fail FK.
-- Also harden org-create trigger so service-role / sentinel inserts don't require auth.uid().

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

  INSERT INTO public.organisation_members (org_id, user_id, role)
  VALUES (NEW.id, uid, 'owner');

  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('org_id', NEW.id)
  WHERE id = uid;

  RETURN NEW;
END;
$$;

INSERT INTO public.organisations (id, name, slug, org_type)
VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '_platform',
  '_platform',
  'business'
)
ON CONFLICT (id) DO NOTHING;
