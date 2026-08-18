-- Signal engine stabilization: service-role geo updates, scan throttle, stale weather expiry

ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_environmental_scan_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION update_property_geo(
  p_property_id UUID,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_place_id TEXT DEFAULT NULL,
  p_address_formatted TEXT DEFAULT NULL,
  p_address_components JSONB DEFAULT NULL,
  p_geo_accuracy_m DOUBLE PRECISION DEFAULT NULL,
  p_address_validated BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service_role BOOLEAN;
BEGIN
  v_is_service_role := COALESCE(auth.jwt() ->> 'role', '') = 'service_role';

  UPDATE properties
  SET
    latitude = COALESCE(p_latitude, latitude),
    longitude = COALESCE(p_longitude, longitude),
    place_id = COALESCE(p_place_id, place_id),
    address_formatted = COALESCE(p_address_formatted, address_formatted),
    address_components = COALESCE(p_address_components, address_components),
    geo_accuracy_m = COALESCE(p_geo_accuracy_m, geo_accuracy_m),
    geocoded_at = CASE WHEN p_latitude IS NOT NULL AND p_longitude IS NOT NULL THEN now() ELSE geocoded_at END,
    address_validated_at = CASE WHEN p_address_validated THEN now() ELSE address_validated_at END,
    updated_at = now()
  WHERE id = p_property_id
    AND (
      v_is_service_role
      OR org_id IN (
        SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
      )
    );

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION update_property_geo TO authenticated;
GRANT EXECUTE ON FUNCTION update_property_geo TO service_role;

-- Auto-resolve environmental signals past their forecast window
CREATE OR REPLACE FUNCTION expire_stale_environmental_signals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE signals
  SET disposition = 'dismissed',
      resolved_at = now(),
      updated_at = now()
  WHERE category = 'environmental'
    AND resolved_at IS NULL
    AND disposition NOT IN ('dismissed', 'converted_to_issue', 'converted_to_record')
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_stale_environmental_signals TO service_role;
