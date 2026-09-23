-- Official Source Catalogue — bounded official sections Filla may watch.
-- Catalogue review finds sections. Coverage Watch / News Watch detect change.
-- Knowledge is created only after an authoritative source supports claims.
-- @Docs/03_Data_Model.md · @Docs/29_Knowledge.md

-- ---------------------------------------------------------------------------
-- Last catalogue-review sample (orientation or Search adapter)
-- ---------------------------------------------------------------------------
ALTER TABLE public.knowledge_watch_settings
  ADD COLUMN IF NOT EXISTS catalogue_review jsonb;

COMMENT ON COLUMN public.knowledge_watch_settings.catalogue_review IS
  'Last bounded Official Source Catalogue sample. Orientation or Search metadata — never a queue and never a source import.';

-- ---------------------------------------------------------------------------
-- Catalogue sections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_source_catalogue (
  id text PRIMARY KEY
    CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  jurisdiction text NOT NULL,
  publisher text NOT NULL
    CHECK (publisher IN ('gov.uk', 'hse', 'legislation.gov.uk')),
  title text NOT NULL,
  locator jsonb NOT NULL DEFAULT '{}'::jsonb,
  include_types text[] NOT NULL DEFAULT '{}',
  exclude_types text[] NOT NULL DEFAULT '{}',
  poll_interval_hours integer NOT NULL DEFAULT 24
    CHECK (poll_interval_hours BETWEEN 1 AND 168),
  subject_keys text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'accepted', 'paused')),
  last_scan_at timestamptz,
  last_scan_ok boolean,
  last_scan_error text,
  tracked_page_count integer NOT NULL DEFAULT 0
    CHECK (tracked_page_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.knowledge_source_catalogue IS
  'Human-approved bounded official sections. Accepting a taxon means watch this section — not import everything.';

CREATE INDEX IF NOT EXISTS knowledge_source_catalogue_status_idx
  ON public.knowledge_source_catalogue (status);

ALTER TABLE public.knowledge_source_catalogue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_source_catalogue_select_admin ON public.knowledge_source_catalogue;
CREATE POLICY knowledge_source_catalogue_select_admin ON public.knowledge_source_catalogue
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON public.knowledge_source_catalogue FROM PUBLIC, anon;
REVOKE ALL ON public.knowledge_source_catalogue FROM authenticated;
GRANT SELECT ON public.knowledge_source_catalogue TO authenticated;
GRANT ALL ON public.knowledge_source_catalogue TO service_role;

-- ---------------------------------------------------------------------------
-- Tracked pages inside accepted sections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_source_catalogue_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogue_id text NOT NULL REFERENCES public.knowledge_source_catalogue(id) ON DELETE CASCADE,
  canonical_path text NOT NULL,
  source_url text NOT NULL,
  content_id text,
  public_updated_at timestamptz,
  document_type text,
  section_hash text,
  status text NOT NULL DEFAULT 'assessing'
    CHECK (status IN ('tracked', 'assessing', 'withdrawn', 'ignored')),
  detection text NOT NULL DEFAULT 'none'
    CHECK (detection IN ('none', 'new_guidance', 'guidance_changed', 'potential_change', 'withdrawn')),
  knowledge_ids uuid[] NOT NULL DEFAULT '{}',
  title text,
  last_checked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalogue_id, canonical_path)
);

COMMENT ON TABLE public.knowledge_source_catalogue_pages IS
  'Pages tracked inside an accepted catalogue section. Metadata-first freshness; news is potential_change, never Knowledge.';

CREATE INDEX IF NOT EXISTS knowledge_source_catalogue_pages_detection_idx
  ON public.knowledge_source_catalogue_pages (detection)
  WHERE detection <> 'none';

ALTER TABLE public.knowledge_source_catalogue_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_source_catalogue_pages_select_admin ON public.knowledge_source_catalogue_pages;
CREATE POLICY knowledge_source_catalogue_pages_select_admin ON public.knowledge_source_catalogue_pages
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON public.knowledge_source_catalogue_pages FROM PUBLIC, anon;
REVOKE ALL ON public.knowledge_source_catalogue_pages FROM authenticated;
GRANT SELECT ON public.knowledge_source_catalogue_pages TO authenticated;
GRANT ALL ON public.knowledge_source_catalogue_pages TO service_role;

-- ---------------------------------------------------------------------------
-- Seed: six England families (proposed until a human accepts the shape)
-- ---------------------------------------------------------------------------
INSERT INTO public.knowledge_source_catalogue (
  id, jurisdiction, publisher, title, locator, include_types, exclude_types,
  poll_interval_hours, subject_keys, status
) VALUES
  (
    'england-landlord-renting',
    'England',
    'gov.uk',
    'Landlord duties and renting',
    '{"adapter":"govuk_search","organisation_slug":"ministry-of-housing-communities-and-local-government","path_prefixes":["/renting-out-a-property","/private-renting","/government/publications/how-to-let","/government/publications/how-to-rent"],"seed_paths":["/renting-out-a-property","/private-renting"],"news_query":"private rented sector landlord duties"}'::jsonb,
    ARRAY['guide','guidance','detailed_guide','statutory_guidance','document_collection','publication','official'],
    ARRAY['transaction','local_transaction','answer','smart_answer','simple_smart_answer','completed_transaction','form','place','licence','finder'],
    24,
    ARRAY['landlord-duties','smoke-carbon-monoxide-alarms','before-heating-season'],
    'proposed'
  ),
  (
    'england-building-regs',
    'England',
    'gov.uk',
    'Building regulations and Approved Documents',
    '{"adapter":"govuk_search","organisation_slug":"ministry-of-housing-communities-and-local-government","path_prefixes":["/building-regulations","/government/collections/approved-documents","/guidance/building-regulations-and-approved-documents-index"],"seed_paths":["/building-regulations","/government/collections/approved-documents"],"news_query":"building regulations approved documents"}'::jsonb,
    ARRAY['guide','guidance','detailed_guide','statutory_guidance','document_collection','publication','official'],
    ARRAY['transaction','local_transaction','answer','smart_answer','simple_smart_answer','completed_transaction','form','place','licence','finder'],
    24,
    ARRAY['building-regulations'],
    'proposed'
  ),
  (
    'england-planning-pd',
    'England',
    'gov.uk',
    'Planning and permitted development',
    '{"adapter":"govuk_search","path_prefixes":["/planning-permission-england-wales","/guidance/when-you-need-planning-permission","/guidance/permitted-development-rights-for-householders"],"seed_paths":["/planning-permission-england-wales"],"news_query":"planning permission permitted development"}'::jsonb,
    ARRAY['guide','guidance','detailed_guide','statutory_guidance','document_collection','publication','official'],
    ARRAY['transaction','local_transaction','answer','smart_answer','simple_smart_answer','completed_transaction','form','place','licence','finder'],
    24,
    ARRAY['planning-permission','permitted-development'],
    'proposed'
  ),
  (
    'england-epc-energy',
    'England',
    'gov.uk',
    'EPC and property energy standards',
    '{"adapter":"govuk_search","path_prefixes":["/buy-sell-your-home/energy-performance-certificates","/guidance/domestic-private-rented-property-minimum-energy-efficiency-standard-minimum-energy-efficiency-standard-mees"],"seed_paths":["/buy-sell-your-home/energy-performance-certificates"],"news_query":"energy performance certificate private rented MEES"}'::jsonb,
    ARRAY['guide','guidance','detailed_guide','statutory_guidance','document_collection','publication','official'],
    ARRAY['transaction','local_transaction','answer','smart_answer','simple_smart_answer','completed_transaction','form','place','licence','finder'],
    24,
    ARRAY['energy-performance','epc'],
    'proposed'
  ),
  (
    'england-hse-property-safety',
    'England',
    'hse',
    'HSE property-safety guidance',
    '{"adapter":"path_prefix","organisation_slug":"health-and-safety-executive","path_prefixes":["/gas/landlords","/gas/domestic","/electricity","/asbestos"],"seed_paths":["https://www.hse.gov.uk/gas/landlords/index.htm","https://www.hse.gov.uk/asbestos/duty.htm"],"news_query":"HSE landlord gas electrical asbestos"}'::jsonb,
    ARRAY['guide','guidance','detailed_guide','statutory_guidance','document_collection','publication','official'],
    ARRAY['transaction','local_transaction','answer','smart_answer','simple_smart_answer','completed_transaction','form','place','licence','finder'],
    24,
    ARRAY['before-heating-season','electrical-safety','asbestos'],
    'proposed'
  ),
  (
    'england-bsr',
    'England',
    'gov.uk',
    'Building Safety Regulator guidance',
    '{"adapter":"govuk_search","organisation_slug":"building-safety-regulator","path_prefixes":["/government/organisations/building-safety-regulator","/guidance/the-building-safety-act","/guidance/manage-a-building-as-an-accountable-person"],"seed_paths":["/government/organisations/building-safety-regulator"],"news_query":"building safety regulator accountable person"}'::jsonb,
    ARRAY['guide','guidance','detailed_guide','statutory_guidance','document_collection','publication','official'],
    ARRAY['transaction','local_transaction','answer','smart_answer','simple_smart_answer','completed_transaction','form','place','licence','finder'],
    24,
    ARRAY['building-safety'],
    'proposed'
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_knowledge_source_catalogue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review jsonb;
  v_sections jsonb;
  v_detections jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin' USING ERRCODE = '42501';
  END IF;

  SELECT catalogue_review INTO v_review
  FROM knowledge_watch_settings
  WHERE id = 'default';

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.title), '[]'::jsonb)
  INTO v_sections
  FROM knowledge_source_catalogue s;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.updated_at DESC), '[]'::jsonb)
  INTO v_detections
  FROM (
    SELECT
      id,
      catalogue_id,
      canonical_path,
      source_url,
      title,
      status,
      detection,
      knowledge_ids,
      public_updated_at,
      last_checked_at,
      updated_at
    FROM knowledge_source_catalogue_pages
    WHERE detection IN ('new_guidance', 'guidance_changed', 'potential_change', 'withdrawn')
    ORDER BY updated_at DESC
    LIMIT 20
  ) p;

  RETURN jsonb_build_object(
    'sections', v_sections,
    'review', v_review,
    'detections', v_detections
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_knowledge_source_catalogue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_knowledge_source_catalogue() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_accept_knowledge_catalogue(
  p_ids text[] DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_platform uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_ids text[];
  v_id text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    SELECT COALESCE(array_agg(id), ARRAY[]::text[])
    INTO v_ids
    FROM knowledge_source_catalogue
    WHERE jurisdiction = 'England';
  ELSE
    IF cardinality(p_ids) > 20 THEN
      RAISE EXCEPTION 'too_many_ids';
    END IF;
    v_ids := p_ids;
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    IF v_id IS NULL OR v_id !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' THEN
      RAISE EXCEPTION 'invalid_catalogue_id';
    END IF;
    UPDATE knowledge_source_catalogue
    SET status = 'accepted', updated_at = now()
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'unknown_catalogue_id' USING DETAIL = v_id;
    END IF;
  END LOOP;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_platform,
    v_uid,
    'knowledge_source_catalogue',
    v_platform,
    'accept',
    jsonb_build_object('reason', trim(p_reason), 'ids', to_jsonb(v_ids))
  );

  RETURN public.admin_list_knowledge_source_catalogue();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_accept_knowledge_catalogue(text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_accept_knowledge_catalogue(text[], text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_knowledge_catalogue_status(
  p_id text,
  p_status text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_platform uuid := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR p_id !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' THEN
    RAISE EXCEPTION 'invalid_catalogue_id';
  END IF;
  IF p_status NOT IN ('proposed', 'accepted', 'paused') THEN
    RAISE EXCEPTION 'invalid_catalogue_status';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  UPDATE knowledge_source_catalogue
  SET status = p_status, updated_at = now()
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_catalogue_id';
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    v_platform,
    v_uid,
    'knowledge_source_catalogue',
    v_platform,
    'update',
    jsonb_build_object('reason', trim(p_reason), 'id', p_id, 'status', p_status)
  );

  RETURN public.admin_list_knowledge_source_catalogue();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_knowledge_catalogue_status(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_knowledge_catalogue_status(text, text, text) TO authenticated, service_role;
