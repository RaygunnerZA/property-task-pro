-- Restore property geo columns expected by update_property_geo / environmental-scanner
-- (omitted from baseline CREATE TABLE). Add country/postcode for register routing.
-- Add property_enrichments for official-register facts (v1: England & Wales EPC).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS address_formatted text,
  ADD COLUMN IF NOT EXISTS address_components jsonb,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz,
  ADD COLUMN IF NOT EXISTS address_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS geo_accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS postal_code text;

COMMENT ON COLUMN public.properties.country_code IS 'ISO-3166-1 alpha-2 derived from geocoding / Places.';
COMMENT ON COLUMN public.properties.postal_code IS 'Postal code derived from geocoding / Places.';

DROP FUNCTION IF EXISTS public.update_property_geo(uuid, double precision, double precision, text, text, jsonb, double precision, boolean);

CREATE FUNCTION public.update_property_geo(
  p_property_id uuid,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_place_id text DEFAULT NULL,
  p_address_formatted text DEFAULT NULL,
  p_address_components jsonb DEFAULT NULL,
  p_geo_accuracy_m double precision DEFAULT NULL,
  p_address_validated boolean DEFAULT false,
  p_country_code text DEFAULT NULL,
  p_postal_code text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    country_code = COALESCE(p_country_code, country_code),
    postal_code = COALESCE(p_postal_code, postal_code),
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

REVOKE ALL ON FUNCTION public.update_property_geo(
  uuid, double precision, double precision, text, text, jsonb, double precision, boolean, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_property_geo(
  uuid, double precision, double precision, text, text, jsonb, double precision, boolean, text, text
) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.property_enrichments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL,
  source_id text,
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_enrichments_status_check
    CHECK (status = ANY (ARRAY['found'::text, 'not_found'::text, 'error'::text])),
  CONSTRAINT property_enrichments_property_provider_key UNIQUE (property_id, provider)
);

CREATE INDEX IF NOT EXISTS property_enrichments_org_property_idx
  ON public.property_enrichments (org_id, property_id);

COMMENT ON TABLE public.property_enrichments IS
  'Official-register facts for a property (e.g. uk_epc). Not Signals, Knowledge, or Compliance.';

ALTER TABLE public.property_enrichments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_enrichments_select ON public.property_enrichments;
CREATE POLICY property_enrichments_select ON public.property_enrichments
  FOR SELECT TO authenticated
  USING (public.member_can_access_property(org_id, property_id));

REVOKE ALL ON public.property_enrichments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.property_enrichments TO authenticated;
GRANT ALL ON public.property_enrichments TO service_role;
