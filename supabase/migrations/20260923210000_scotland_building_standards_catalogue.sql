-- Scottish Building Standards — one bounded Official Source Catalogue section.
-- Collection page is the seed; do not import every handbook/PDF wholesale.
-- @Docs/03_Data_Model.md · @Docs/29_Knowledge.md

-- ---------------------------------------------------------------------------
-- Publisher allowlist: add gov.scot
-- ---------------------------------------------------------------------------
ALTER TABLE public.knowledge_source_catalogue
  DROP CONSTRAINT IF EXISTS knowledge_source_catalogue_publisher_check;

ALTER TABLE public.knowledge_source_catalogue
  ADD CONSTRAINT knowledge_source_catalogue_publisher_check
  CHECK (publisher IN ('gov.uk', 'hse', 'legislation.gov.uk', 'gov.scot'));

-- ---------------------------------------------------------------------------
-- Seed: single Scotland Building Standards catalogue (proposed until accepted)
-- ---------------------------------------------------------------------------
INSERT INTO public.knowledge_source_catalogue (
  id, jurisdiction, publisher, title, locator, include_types, exclude_types,
  poll_interval_hours, subject_keys, status
) VALUES (
  'scotland-building-standards',
  'Scotland',
  'gov.scot',
  'Scottish Building Standards',
  '{
    "adapter":"collection_page",
    "collection_url":"https://www.gov.scot/collections/building-standards/",
    "path_prefixes":["/collections/building-standards","/publications/","/binaries/content/documents/govscot/publications"],
    "seed_paths":["https://www.gov.scot/collections/building-standards/"],
    "news_query":"building standards scotland consultation",
    "watch_areas":[
      "Current domestic handbook",
      "Current non-domestic handbook",
      "Summary and notices of changes",
      "Supporting guidance for Sections 0–7",
      "Procedural and enforcement guidance",
      "Building-standards legislation"
    ],
    "index_only":[
      "superseded handbooks",
      "archived supporting publications",
      "research reports",
      "specialist non-domestic material",
      "external tools and calculators"
    ],
    "priority_change_notice":"April 2026 — General, Fire, Environment and Safety (traditional-building conversions, automatic fire suppression, flooding/groundwater, letterplate positioning)",
    "applicability_rule":"Applicable regulations and guidance depend on the date of the building-warrant application; where no warrant is required, the date work commenced."
  }'::jsonb,
  ARRAY['guide','guidance','detailed_guide','statutory_guidance','document_collection','publication','official','consultation'],
  ARRAY['transaction','form','finder','calculator','tool'],
  24,
  ARRAY['building-regulations','building-standards','scotland-building-standards'],
  'proposed'
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Applicability: preserve Scotland edition / warrant-date triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_knowledge_applicability(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v jsonb := COALESCE(p, '{}'::jsonb);
  v_audiences text[];
  v_result jsonb;
  v_applies jsonb;
  v_building_scope text;
  v_edition text;
BEGIN
  IF jsonb_typeof(v) <> 'object' THEN
    RAISE EXCEPTION 'applicability_must_be_object';
  END IF;

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

  v_result := jsonb_build_object(
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

  -- Optional Scottish Building Standards edition / warrant triggers (first-class).
  v_building_scope := nullif(btrim(COALESCE(v->>'building_scope', '')), '');
  IF v_building_scope IS NOT NULL THEN
    v_result := v_result || jsonb_build_object('building_scope', v_building_scope);
  END IF;

  v_edition := nullif(btrim(COALESCE(v->>'edition', '')), '');
  IF v_edition IS NOT NULL THEN
    v_result := v_result || jsonb_build_object('edition', v_edition);
  END IF;

  IF jsonb_typeof(v->'applies_when') = 'object' THEN
    v_applies := jsonb_strip_nulls(jsonb_build_object(
      'warrant_submitted_on_or_after',
        nullif(btrim(COALESCE(v->'applies_when'->>'warrant_submitted_on_or_after', '')), ''),
      'or_unwarranted_work_commenced_on_or_after',
        nullif(btrim(COALESCE(v->'applies_when'->>'or_unwarranted_work_commenced_on_or_after', '')), '')
    ));
    IF v_applies <> '{}'::jsonb THEN
      v_result := v_result || jsonb_build_object('applies_when', v_applies);
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_knowledge_applicability(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_knowledge_applicability(jsonb) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
