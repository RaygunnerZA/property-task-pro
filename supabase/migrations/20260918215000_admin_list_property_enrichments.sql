-- Platform-admin read of official-register enrichments (v1: uk_epc).
-- Named RPC only — do not add is_platform_admin() to property_enrichments RLS.
-- Canonical: @Docs/03_Data_Model.md · @Docs/25_Phase2_Admin_Panel_Spec.md

CREATE OR REPLACE FUNCTION public.admin_list_property_enrichments(
  p_org_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  property_id UUID,
  property_label TEXT,
  country_code TEXT,
  postal_code TEXT,
  provider TEXT,
  status TEXT,
  source_id TEXT,
  current_rating TEXT,
  current_efficiency TEXT,
  potential_rating TEXT,
  potential_efficiency TEXT,
  floor_area TEXT,
  property_type TEXT,
  built_form TEXT,
  construction_age_band TEXT,
  lodgement_date TEXT,
  retrieved_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200);

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'platform',
    COALESCE(p_org_id, auth.uid()),
    'admin.property_enrichments.listed',
    jsonb_build_object('org_id', p_org_id, 'limit', v_limit)
  );

  RETURN QUERY
  SELECT
    e.org_id,
    o.name,
    e.property_id,
    COALESCE(NULLIF(btrim(p.nickname), ''), NULLIF(btrim(p.address), ''), e.property_id::text),
    p.country_code,
    p.postal_code,
    e.provider,
    e.status,
    e.source_id,
    NULLIF(btrim(e.facts ->> 'current_rating'), ''),
    NULLIF(btrim(e.facts ->> 'current_efficiency'), ''),
    NULLIF(btrim(e.facts ->> 'potential_rating'), ''),
    NULLIF(btrim(e.facts ->> 'potential_efficiency'), ''),
    NULLIF(btrim(e.facts ->> 'floor_area'), ''),
    NULLIF(btrim(e.facts ->> 'property_type'), ''),
    NULLIF(btrim(e.facts ->> 'built_form'), ''),
    NULLIF(btrim(e.facts ->> 'construction_age_band'), ''),
    NULLIF(btrim(e.facts ->> 'lodgement_date'), ''),
    e.retrieved_at
  FROM public.property_enrichments e
  JOIN public.properties p ON p.id = e.property_id
  JOIN public.organisations o ON o.id = e.org_id
  WHERE o.id <> '00000000-0000-0000-0000-000000000000'::uuid
    AND (p_org_id IS NULL OR e.org_id = p_org_id)
  ORDER BY e.retrieved_at DESC NULLS LAST, e.property_id
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_property_enrichments(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_property_enrichments(UUID, INT) TO authenticated, service_role;
