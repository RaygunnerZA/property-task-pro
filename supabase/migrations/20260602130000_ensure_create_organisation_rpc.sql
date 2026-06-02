-- Repair: legacy remotes may lack org_type enum/column and org-creation RPCs.
-- Safe to re-run (idempotent).

DO $$
BEGIN
  CREATE TYPE org_type AS ENUM ('personal', 'business', 'contractor');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organisations'
      AND column_name = 'org_type'
  ) THEN
    ALTER TABLE organisations
      ADD COLUMN org_type org_type NOT NULL DEFAULT 'business';
  END IF;
END
$$;

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
  IF p_org_type = 'personal' THEN
    SELECT COUNT(*) INTO v_personal_count
    FROM organisations
    WHERE created_by = p_user_id
      AND org_type = 'personal';

    IF v_personal_count > 0 THEN
      RETURN TRUE;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM organisations
  WHERE created_by = p_user_id
    AND LOWER(TRIM(name)) = LOWER(TRIM(p_org_name))
    AND (p_org_type IS NULL OR org_type = p_org_type);

  RETURN v_count > 0;
END;
$$;

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

  INSERT INTO organisation_members (user_id, org_id, role)
  VALUES (creator_id, new_org_id, 'owner');

  RETURN new_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION check_duplicate_org_name(TEXT, UUID, org_type) TO authenticated;
GRANT EXECUTE ON FUNCTION create_organisation(TEXT, org_type, UUID) TO authenticated;
