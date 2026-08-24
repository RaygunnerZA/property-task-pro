-- Soften applicability audience normalisation for Intake spreadsheets.
-- Map common labels (Property Manager → manager) and drop unknowns
-- instead of failing the entire bulk import with invalid_applicability_audience.

CREATE OR REPLACE FUNCTION public.canonicalize_knowledge_audience(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE lower(trim(COALESCE(p, '')))
    WHEN 'owner' THEN 'owner'
    WHEN 'landlord' THEN 'owner'
    WHEN 'homeowner' THEN 'owner'
    WHEN 'proprietor' THEN 'owner'
    WHEN 'freeholder' THEN 'owner'
    WHEN 'manager' THEN 'manager'
    WHEN 'property manager' THEN 'manager'
    WHEN 'managing agent' THEN 'manager'
    WHEN 'agent' THEN 'manager'
    WHEN 'admin' THEN 'manager'
    WHEN 'administrator' THEN 'manager'
    WHEN 'field' THEN 'field'
    WHEN 'staff' THEN 'field'
    WHEN 'operative' THEN 'field'
    WHEN 'technician' THEN 'field'
    WHEN 'contractor' THEN 'field'
    WHEN 'tradesperson' THEN 'field'
    WHEN 'tenant' THEN 'tenant'
    WHEN 'resident' THEN 'tenant'
    WHEN 'renter' THEN 'tenant'
    WHEN 'occupant' THEN 'tenant'
    WHEN 'leaseholder' THEN 'tenant'
    WHEN 'public' THEN 'public'
    WHEN 'anyone' THEN 'public'
    WHEN 'general' THEN 'public'
    WHEN 'consumer' THEN 'public'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_knowledge_applicability(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v jsonb := COALESCE(p, '{}'::jsonb);
  v_audiences text[];
BEGIN
  IF jsonb_typeof(v) <> 'object' THEN
    RAISE EXCEPTION 'applicability_must_be_object';
  END IF;

  -- Split compound cells ("Owner / Manager", "owner, tenant") then canonicalize.
  v_audiences := ARRAY(
    SELECT DISTINCT canon
    FROM (
      SELECT public.canonicalize_knowledge_audience(token) AS canon
      FROM jsonb_array_elements_text(COALESCE(v->'audiences', '[]'::jsonb)) AS t(raw)
      CROSS JOIN LATERAL unnest(
        regexp_split_to_array(lower(trim(raw)), E'\\s*(?:,|;|\\||/|&|\\+|\\band\\b)\\s*')
      ) AS token
      WHERE length(trim(token)) > 0
    ) s
    WHERE canon IS NOT NULL
  );

  RETURN jsonb_build_object(
    'jurisdictions', COALESCE(
      (SELECT jsonb_agg(to_jsonb(trim(x)) ORDER BY trim(x))
       FROM jsonb_array_elements_text(COALESCE(v->'jurisdictions', '[]'::jsonb)) AS t(x)
       WHERE length(trim(x)) > 0),
      '[]'::jsonb
    ),
    'regions', COALESCE(
      (SELECT jsonb_agg(to_jsonb(trim(x)) ORDER BY trim(x))
       FROM jsonb_array_elements_text(COALESCE(v->'regions', '[]'::jsonb)) AS t(x)
       WHERE length(trim(x)) > 0),
      '[]'::jsonb
    ),
    'languages', COALESCE(
      (SELECT jsonb_agg(to_jsonb(trim(x)) ORDER BY trim(x))
       FROM jsonb_array_elements_text(COALESCE(v->'languages', '[]'::jsonb)) AS t(x)
       WHERE length(trim(x)) > 0),
      '[]'::jsonb
    ),
    'audiences', COALESCE(
      (SELECT jsonb_agg(to_jsonb(a) ORDER BY a) FROM unnest(v_audiences) AS a),
      '[]'::jsonb
    ),
    'unscoped', COALESCE((v->>'unscoped')::boolean, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.canonicalize_knowledge_audience(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_knowledge_applicability(jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
