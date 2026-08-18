-- Repair: ensure property creation RPCs exist on legacy/partial remotes (idempotent).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE properties
      ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END
$$;

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
  SELECT COUNT(*) INTO v_count
  FROM properties
  WHERE org_id = p_org_id
    AND LOWER(TRIM(address)) = LOWER(TRIM(p_address));

  RETURN v_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION create_property_v2(
  p_org_id UUID,
  p_address TEXT,
  p_nickname TEXT DEFAULT NULL,
  p_icon_name TEXT DEFAULT NULL,
  p_icon_color_hex TEXT DEFAULT NULL,
  p_thumbnail_url TEXT DEFAULT NULL
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
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;

  SELECT COUNT(*) INTO v_membership_count
  FROM organisation_members
  WHERE org_id = p_org_id
    AND user_id = v_user_id;

  IF v_membership_count = 0 THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;

  has_duplicate := check_duplicate_property_address(p_org_id, p_address);

  IF has_duplicate THEN
    RAISE EXCEPTION 'A property with this address already exists in your organisation. Please use a different address.';
  END IF;

  INSERT INTO properties (
    org_id,
    address,
    nickname,
    icon_name,
    icon_color_hex,
    thumbnail_url
  )
  VALUES (
    p_org_id,
    p_address,
    p_nickname,
    p_icon_name,
    p_icon_color_hex,
    p_thumbnail_url
  )
  RETURNING json_build_object(
    'id', id,
    'org_id', org_id,
    'address', address,
    'nickname', nickname,
    'icon_name', icon_name,
    'icon_color_hex', icon_color_hex,
    'thumbnail_url', thumbnail_url,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO v_new_property;

  RETURN v_new_property;
END;
$$;

GRANT EXECUTE ON FUNCTION check_duplicate_property_address(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_property_v2(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_property_v2(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
