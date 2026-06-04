-- Property thumbnail uploads: allow all org members to update properties, RPC for thumbnail_url,
-- and HEIC/HEIF on property-images bucket.

DROP POLICY IF EXISTS "properties_update" ON properties;

CREATE POLICY "properties_update" ON properties
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_property_thumbnail(
  p_property_id UUID,
  p_thumbnail_url TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_property_org_id UUID;
  v_membership_count INTEGER;
  v_updated_property JSON;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Access Denied: User must be authenticated';
  END IF;

  SELECT org_id INTO v_property_org_id
  FROM properties
  WHERE id = p_property_id;

  IF v_property_org_id IS NULL THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  SELECT COUNT(*) INTO v_membership_count
  FROM organisation_members
  WHERE org_id = v_property_org_id
    AND user_id = v_user_id;

  IF v_membership_count = 0 THEN
    RAISE EXCEPTION 'Access Denied: User is not a member of this organisation';
  END IF;

  UPDATE properties
  SET thumbnail_url = p_thumbnail_url,
      updated_at = NOW()
  WHERE id = p_property_id
  RETURNING json_build_object(
    'id', id,
    'org_id', org_id,
    'address', address,
    'nickname', nickname,
    'thumbnail_url', thumbnail_url,
    'updated_at', updated_at
  ) INTO v_updated_property;

  RETURN v_updated_property;
END;
$$;

GRANT EXECUTE ON FUNCTION update_property_thumbnail(UUID, TEXT) TO authenticated;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]
WHERE id = 'property-images';
