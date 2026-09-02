-- Knowledge review gates: verify/publish only when mandatory checks pass.
-- Also: fix intake source rows (official URL vs workbook provenance) + safe backfill.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.knowledge_text_is_row_ref(p text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL OR btrim(p) = '' THEN false
    WHEN btrim(p) ~ '^\d{1,6}$' THEN true
    WHEN btrim(p) ~ '^[A-Za-z]{1,3}\d{1,6}$' THEN true
    WHEN lower(btrim(p)) ~ '^row\s*\d+$' THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.knowledge_text_is_meaningful_guidance(p text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL OR length(btrim(p)) < 12 THEN false
    WHEN public.knowledge_text_is_row_ref(p) THEN false
    WHEN btrim(p) !~ '[A-Za-zÀ-ÿ]' THEN false
    ELSE true
  END;
$$;

CREATE OR REPLACE FUNCTION public.knowledge_url_is_http(p text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p IS NOT NULL
    AND btrim(p) ~* '^https?://[^[:space:]]+$'
    AND NOT public.knowledge_text_is_row_ref(p);
$$;

CREATE OR REPLACE FUNCTION public.knowledge_has_authoritative_source(p_knowledge_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.knowledge_sources s
    WHERE s.knowledge_id = p_knowledge_id
      AND public.knowledge_url_is_http(s.url)
  )
  OR EXISTS (
    SELECT 1
    FROM public.knowledge k
    WHERE k.id = p_knowledge_id
      AND (
        public.knowledge_url_is_http(k.provenance #>> '{intake_provenance,source_url}')
        OR public.knowledge_url_is_http(k.provenance->>'source_url')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.knowledge_critic_passed(p_knowledge_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.knowledge k
    WHERE k.id = p_knowledge_id
      AND k.provenance ? 'critic_at'
      AND COALESCE(k.provenance->>'critic_status', '') IS DISTINCT FROM 'unavailable'
      AND COALESCE((k.provenance->>'critic_passed')::boolean, false) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.knowledge_assert_ready_for_status(
  p_knowledge_id uuid,
  p_status text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge;
  v_guidance text;
  v_app jsonb;
  v_jurisdictions jsonb;
  v_regions jsonb;
  v_joined text;
BEGIN
  SELECT * INTO v_row FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  IF p_status NOT IN ('verified', 'published') THEN
    RETURN;
  END IF;

  v_guidance := COALESCE(nullif(btrim(v_row.summary), ''), nullif(btrim(v_row.body), ''), nullif(btrim(v_row.attributes->>'action'), ''));
  IF NOT public.knowledge_text_is_meaningful_guidance(v_guidance) THEN
    RAISE EXCEPTION 'guidance_required';
  END IF;

  IF NOT public.knowledge_has_authoritative_source(p_knowledge_id) THEN
    RAISE EXCEPTION 'authoritative_source_required';
  END IF;

  IF NOT public.knowledge_critic_passed(p_knowledge_id) THEN
    RAISE EXCEPTION 'critic_required';
  END IF;

  v_app := COALESCE(v_row.applicability, '{}'::jsonb);
  IF COALESCE((v_app->>'unscoped')::boolean, false) IS NOT TRUE THEN
    v_jurisdictions := COALESCE(v_app->'jurisdictions', '[]'::jsonb);
    v_regions := COALESCE(v_app->'regions', '[]'::jsonb);
    IF jsonb_typeof(v_jurisdictions) <> 'array' OR jsonb_array_length(v_jurisdictions) = 0 THEN
      RAISE EXCEPTION 'applicability_jurisdiction_required';
    END IF;

    v_joined := lower(v_jurisdictions::text || ' ' || v_regions::text);
    IF v_joined ~ 'united kingdom|\buk\b|\bgb\b|great britain'
       AND v_joined !~ 'england|wales|scotland|northern ireland|gb-eng|gb-wls|gb-sct|gb-nir' THEN
      RAISE EXCEPTION 'applicability_uk_nation_required';
    END IF;
  END IF;

  IF p_status = 'published' THEN
    IF v_row.status <> 'verified' THEN
      RAISE EXCEPTION 'verify_before_publish';
    END IF;
    IF v_row.reviewed_by IS NULL THEN
      RAISE EXCEPTION 'human_verifier_required';
    END IF;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Status transition (gated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_knowledge_status(p_knowledge_id uuid, p_status text)
RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge;
  v_min INT := public.brain_min_cohort();
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  IF p_status NOT IN ('candidate', 'verified', 'published', 'stale', 'archived') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO v_row FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  IF p_status = 'published' AND v_row.status = 'candidate' THEN
    RAISE EXCEPTION 'verify_before_publish';
  END IF;

  IF p_status IN ('verified', 'published') THEN
    PERFORM public.knowledge_assert_ready_for_status(p_knowledge_id, p_status);
  END IF;

  IF p_status = 'published'
     AND v_row.source_kind = 'community_brain'
     AND (v_row.cohort_size IS NULL OR v_row.cohort_size < v_min) THEN
    RAISE EXCEPTION 'cohort_below_minimum';
  END IF;

  UPDATE public.knowledge
  SET
    status = p_status,
    reviewed_by = CASE
      WHEN p_status IN ('verified', 'published', 'archived', 'stale') THEN auth.uid()
      ELSE reviewed_by
    END,
    published_at = CASE WHEN p_status = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
    updated_at = now()
  WHERE id = p_knowledge_id
  RETURNING * INTO v_row;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    COALESCE(v_row.org_id, '00000000-0000-0000-0000-000000000000'::uuid),
    auth.uid(),
    'knowledge',
    v_row.id,
    'admin.knowledge.status_set',
    jsonb_build_object('status', p_status)
  );

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (
    v_row.id,
    v_row.org_id,
    CASE
      WHEN p_status = 'published' THEN 'publish'
      WHEN p_status = 'archived' THEN 'archive'
      WHEN p_status = 'stale' THEN 'stale'
      WHEN p_status = 'verified' THEN 'human_approve'
      WHEN p_status = 'candidate' THEN 'human_edit'
      ELSE 'human_reject'
    END,
    auth.uid(),
    jsonb_build_object('status', p_status, 'via', 'admin')
  );

  RETURN v_row;
END;
$$;

-- Critic apply: store structured result; NEVER auto-verify (human mandatory).
DROP FUNCTION IF EXISTS public.apply_knowledge_critic_result(uuid, numeric, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.apply_knowledge_critic_result(
  p_knowledge_id uuid,
  p_trust_score numeric,
  p_critic_notes text DEFAULT NULL,
  p_critic_model text DEFAULT NULL,
  p_critic_provider text DEFAULT NULL,
  p_mark_verified boolean DEFAULT false,
  p_critic_passed boolean DEFAULT NULL,
  p_critic_result jsonb DEFAULT NULL
) RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge;
  v_passed boolean;
  v_unavailable boolean;
BEGIN
  v_unavailable := COALESCE(p_critic_notes, '') ~* 'critic unavailable|default trust retained|no eligible strategy';
  v_passed := CASE
    WHEN v_unavailable THEN false
    WHEN p_critic_passed IS NOT NULL THEN p_critic_passed
    WHEN p_mark_verified THEN true
    ELSE false
  END;

  UPDATE public.knowledge
  SET
    trust_score = p_trust_score,
    provenance = provenance || jsonb_build_object(
      'critic_model', p_critic_model,
      'critic_provider', p_critic_provider,
      'critic_notes', p_critic_notes,
      'critic_at', now(),
      'critic_passed', v_passed,
      'critic_status', CASE WHEN v_unavailable THEN 'unavailable' ELSE 'completed' END,
      'critic_result', COALESCE(p_critic_result, '{}'::jsonb)
    ),
    -- Human verify only — ignore p_mark_verified for status.
    updated_at = now()
  WHERE id = p_knowledge_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (
    v_row.id,
    v_row.org_id,
    'critic',
    NULL,
    jsonb_build_object(
      'trust_score', p_trust_score,
      'notes', p_critic_notes,
      'model', p_critic_model,
      'provider', p_critic_provider,
      'passed', v_passed,
      'result', COALESCE(p_critic_result, '{}'::jsonb)
    )
  );

  RETURN v_row;
END;
$$;

-- Batch sources for queue/detail agreement
CREATE OR REPLACE FUNCTION public.admin_list_knowledge_sources(p_knowledge_ids uuid[])
RETURNS SETOF public.knowledge_sources
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.*
  FROM public.knowledge_sources s
  WHERE s.knowledge_id = ANY(p_knowledge_ids)
  ORDER BY s.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_knowledge_sources(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.knowledge_assert_ready_for_status(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Safe backfill: clear row-number guidance/URLs; split official URL from workbook label
-- ---------------------------------------------------------------------------
UPDATE public.knowledge k
SET
  summary = CASE WHEN public.knowledge_text_is_row_ref(k.summary) THEN NULL ELSE k.summary END,
  body = CASE WHEN public.knowledge_text_is_row_ref(k.body) THEN NULL ELSE k.body END,
  updated_at = now()
WHERE public.knowledge_text_is_row_ref(k.summary)
   OR public.knowledge_text_is_row_ref(k.body);

UPDATE public.knowledge_sources s
SET
  url = CASE
    WHEN public.knowledge_url_is_http(s.url) THEN s.url
    ELSE NULL
  END,
  label = CASE
    WHEN public.knowledge_url_is_http(s.url)
         AND (s.label ILIKE '%.xlsx' OR s.label ILIKE '%spreadsheet%' OR s.label ILIKE '%.csv')
    THEN COALESCE(
      NULLIF(s.metadata->>'citation', ''),
      regexp_replace(
        COALESCE(substring(s.url from 'https?://([^/]+)'), 'Official source'),
        '^www\.',
        ''
      )
    )
    ELSE s.label
  END,
  source_type = CASE
    WHEN public.knowledge_url_is_http(s.url) THEN 'url'
    ELSE s.source_type
  END
WHERE s.url IS NOT NULL;

-- When URL source was retyped to url, ensure workbook provenance remains as attachment-only row
-- (no duplicate insert if already clean).

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Bulk create: official URL as authoritative source; workbook as intake only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_bulk_create_platform_knowledge_candidates(
  p_batch_id uuid,
  p_candidates jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_batch public.knowledge_intake_batches;
  v_item jsonb;
  v_row public.knowledge;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_count integer := 0;
  v_title text;
  v_applicability jsonb;
  v_attributes jsonb;
  v_max integer := 200;
  v_url text;
  v_summary text;
  v_body text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT * INTO v_batch FROM public.knowledge_intake_batches WHERE id = p_batch_id;
  IF v_batch.id IS NULL THEN
    RAISE EXCEPTION 'intake_batch_not_found';
  END IF;

  IF jsonb_typeof(p_candidates) <> 'array' THEN
    RAISE EXCEPTION 'candidates_must_be_array';
  END IF;

  IF jsonb_array_length(p_candidates) = 0 THEN
    RAISE EXCEPTION 'candidates_empty';
  END IF;

  IF jsonb_array_length(p_candidates) > v_max THEN
    RAISE EXCEPTION 'candidates_exceed_max';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_candidates)
  LOOP
    v_title := nullif(trim(COALESCE(v_item->>'title', '')), '');
    IF v_title IS NULL THEN
      CONTINUE;
    END IF;

    v_summary := nullif(trim(COALESCE(v_item->>'summary', '')), '');
    v_body := nullif(trim(COALESCE(v_item->>'body', '')), '');
    IF public.knowledge_text_is_row_ref(v_summary) THEN v_summary := NULL; END IF;
    IF public.knowledge_text_is_row_ref(v_body) THEN v_body := NULL; END IF;

    v_applicability := public.normalize_knowledge_applicability(
      COALESCE(v_item->'applicability', '{}'::jsonb)
    );
    v_attributes := public.normalize_knowledge_attributes(
      COALESCE(v_item->'attributes', '{}'::jsonb)
    );

    IF (
      COALESCE(jsonb_array_length(v_applicability->'jurisdictions'), 0) = 0
      AND COALESCE((v_applicability->>'unscoped')::boolean, false) IS NOT TRUE
    ) THEN
      RAISE EXCEPTION 'applicability_required_for_candidate';
    END IF;

    v_url := nullif(trim(COALESCE(v_item #>> '{provenance,source_url}', '')), '');
    IF v_url IS NOT NULL AND NOT public.knowledge_url_is_http(v_url) THEN
      v_url := NULL;
    END IF;

    INSERT INTO public.knowledge (
      scope, status, org_id, title, summary, body, content, attributes, source_kind,
      provenance, created_by, applicability
    ) VALUES (
      'platform',
      'candidate',
      NULL,
      v_title,
      v_summary,
      v_body,
      COALESCE(v_item->'content', '{}'::jsonb),
      v_attributes,
      'filla_curated',
      jsonb_build_object(
        'intake_batch_id', p_batch_id,
        'source_row', v_item->'source_row',
        'sheet_name', v_item->'sheet_name',
        'intake_provenance', COALESCE(v_item->'provenance', '{}'::jsonb),
        'via', 'admin_bulk_create_platform_knowledge_candidates'
      ),
      auth.uid(),
      v_applicability
    )
    RETURNING * INTO v_row;

    INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
    VALUES (
      v_row.id, NULL, 'candidate_created', auth.uid(),
      jsonb_build_object('source_kind', 'filla_curated', 'intake_batch_id', p_batch_id)
    );

    -- Intake workbook as provenance only (no URL).
    IF v_batch.storage_path IS NOT NULL OR v_batch.source_filename IS NOT NULL THEN
      INSERT INTO public.knowledge_sources (
        knowledge_id, source_type, label, url, external_ref, metadata
      ) VALUES (
        v_row.id,
        'attachment',
        COALESCE(v_batch.source_filename, 'Intake upload'),
        NULL,
        p_batch_id::text,
        jsonb_build_object(
          'intake_batch_id', p_batch_id,
          'storage_bucket', v_batch.storage_bucket,
          'storage_path', v_batch.storage_path,
          'source_row', v_item->'source_row',
          'sheet_name', v_item->'sheet_name',
          'source_mime', v_batch.source_mime,
          'role', 'intake_provenance'
        )
      );
    END IF;

    -- Authoritative URL as separate source.
    IF v_url IS NOT NULL THEN
      INSERT INTO public.knowledge_sources (
        knowledge_id, source_type, label, url, external_ref, metadata
      ) VALUES (
        v_row.id,
        'url',
        COALESCE(
          nullif(trim(COALESCE(v_item #>> '{provenance,citation}', '')), ''),
          regexp_replace(substring(v_url from 'https?://([^/]+)'), '^www\.', '')
        ),
        v_url,
        NULL,
        jsonb_build_object(
          'intake_batch_id', p_batch_id,
          'source_row', v_item->'source_row',
          'sheet_name', v_item->'sheet_name',
          'reviewed_date', v_item #>> '{provenance,reviewed_date}',
          'verification_status', v_item #>> '{provenance,verification_status}',
          'role', 'authoritative'
        )
      );
    END IF;

    v_ids := array_append(v_ids, v_row.id);
    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'no_valid_candidates';
  END IF;

  UPDATE public.knowledge_intake_batches
  SET created_count = v_count, status = 'created', updated_at = now()
  WHERE id = p_batch_id;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'knowledge_intake_batch',
    p_batch_id,
    'admin.knowledge.intake_candidates_created',
    jsonb_build_object('created_count', v_count)
  );

  RETURN jsonb_build_object(
    'batch_id', p_batch_id,
    'created_count', v_count,
    'knowledge_ids', to_jsonb(v_ids)
  );
END;
$$;
