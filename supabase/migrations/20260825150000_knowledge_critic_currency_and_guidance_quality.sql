-- Critic currency after guidance/field edits; stronger verify guidance gate;
-- repair legacy verified rows that fail automated checks.

-- ---------------------------------------------------------------------------
-- Fingerprint of critic-relevant content (must align with TS criticContentFingerprint)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.knowledge_critic_content_fingerprint(p_knowledge_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Plaintext fingerprint aligned with TS criticContentFingerprint (not hashed).
  SELECT left(
    COALESCE(k.summary, '') || E'\n' ||
    COALESCE(k.body, '') || E'\n' ||
    COALESCE(nullif(btrim(k.attributes->>'legal_status'), ''), nullif(btrim(k.attributes->>'classification'), ''), '') || E'\n' ||
    COALESCE(nullif(btrim(k.attributes->>'trigger_type'), ''), nullif(btrim(k.attributes->>'event_trigger'), ''), '') || E'\n' ||
    COALESCE(k.attributes->>'applies_when', '') || E'\n' ||
    COALESCE(k.attributes->>'action', '') || E'\n' ||
    COALESCE(k.attributes->>'evidence', '') || E'\n' ||
    COALESCE(k.attributes->>'frequency', '') || E'\n' ||
    COALESCE(k.attributes->>'risk_or_consequence', '') || E'\n' ||
    COALESCE(k.applicability::text, '{}') || E'\n' ||
    COALESCE(
      (
        SELECT string_agg(u, '|' ORDER BY u)
        FROM (
          SELECT DISTINCT btrim(s.url) AS u
          FROM public.knowledge_sources s
          WHERE s.knowledge_id = k.id
            AND public.knowledge_url_is_http(s.url)
        ) urls
      ),
      ''
    ),
    8000
  )
  FROM public.knowledge k
  WHERE k.id = p_knowledge_id;
$$;

-- Stronger prose gate for verify/publish (deterministic; mirrors client quality checks loosely).
CREATE OR REPLACE FUNCTION public.knowledge_text_is_quality_guidance(p text, p_title text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL OR length(btrim(p)) < 12 THEN false
    WHEN public.knowledge_text_is_row_ref(p) THEN false
    WHEN btrim(p) ~* '^https?://' THEN false
    WHEN btrim(p) !~ '[A-Za-zÀ-ÿ]' THEN false
    WHEN p_title IS NOT NULL
         AND lower(regexp_replace(btrim(p), '[[:punct:]]+', ' ', 'g'))
           = lower(regexp_replace(btrim(p_title), '[[:punct:]]+', ' ', 'g'))
      THEN false
    WHEN btrim(p) ~* '(this knowledge (provides|offers|covers)|overall,? this is (reliable|accurate)|enhancing its credibility)'
      THEN false
    WHEN cardinality(regexp_split_to_array(btrim(p), '\s+')) < 18
         AND btrim(p) ~* '\y(as required|as necessary|as applicable|as appropriate|if required|where required)\y'
      THEN false
    WHEN cardinality(regexp_split_to_array(btrim(p), '\s+')) > 90 THEN false
    ELSE true
  END;
$$;

-- Critic pass requires completed, non-stale result matching current fingerprint.
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
      AND COALESCE(k.provenance->>'critic_status', '') NOT IN (
        'unavailable', 'stale_after_guidance_edit', 'stale', 'stale_after_field_edit'
      )
      AND COALESCE((k.provenance->>'critic_passed')::boolean, false) = true
      AND (
        -- Legacy passes without hash remain valid only until guidance_draft is newer than critic_at.
        (
          NOT (k.provenance ? 'critic_content_hash')
          AND NOT (
            (k.provenance #>> '{guidance_draft,proposed_at}') IS NOT NULL
            AND (k.provenance->>'critic_at') IS NOT NULL
            AND (k.provenance #>> '{guidance_draft,proposed_at}')::timestamptz
              > (k.provenance->>'critic_at')::timestamptz
            AND COALESCE((k.provenance #>> '{guidance_draft,unverified}')::boolean, false) = true
          )
        )
        OR (
          k.provenance ? 'critic_content_hash'
          AND k.provenance->>'critic_content_hash'
            = public.knowledge_critic_content_fingerprint(p_knowledge_id)
        )
      )
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

  v_guidance := COALESCE(nullif(btrim(v_row.summary), ''), nullif(btrim(v_row.body), ''));
  IF NOT public.knowledge_text_is_quality_guidance(v_guidance, v_row.title) THEN
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

-- Shared invalidation: archive prior critic into history; mark not current.
CREATE OR REPLACE FUNCTION public.knowledge_invalidate_critic(
  p_knowledge_id uuid,
  p_reason text DEFAULT 'field_edit'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prov jsonb;
  v_hist jsonb;
  v_entry jsonb;
BEGIN
  SELECT provenance INTO v_prov FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_prov IS NULL THEN
    RETURN;
  END IF;

  v_hist := COALESCE(v_prov->'critic_history', '[]'::jsonb);
  IF jsonb_typeof(v_hist) <> 'array' THEN
    v_hist := '[]'::jsonb;
  END IF;

  IF v_prov ? 'critic_at' THEN
    v_entry := jsonb_build_object(
      'at', v_prov->'critic_at',
      'passed', v_prov->'critic_passed',
      'status', v_prov->'critic_status',
      'result', v_prov->'critic_result',
      'notes', v_prov->'critic_notes',
      'content_hash', v_prov->'critic_content_hash',
      'invalidated_reason', p_reason,
      'invalidated_at', now()
    );
    v_hist := v_hist || jsonb_build_array(v_entry);
  END IF;

  UPDATE public.knowledge
  SET provenance = (v_prov - 'critic_passed' - 'critic_status' - 'critic_result' - 'critic_content_hash')
    || jsonb_build_object(
      'critic_history', v_hist,
      'critic_passed', false,
      'critic_status', CASE
        WHEN p_reason = 'guidance_edit' THEN 'stale_after_guidance_edit'
        ELSE 'stale_after_field_edit'
      END
    ),
    updated_at = now()
  WHERE id = p_knowledge_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_knowledge_draft_guidance(
  p_knowledge_id uuid,
  p_summary text,
  p_body text DEFAULT NULL,
  p_draft_meta jsonb DEFAULT '{}'::jsonb
) RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge;
  v_summary text;
  v_body text;
  v_was_verified boolean;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  v_summary := nullif(btrim(COALESCE(p_summary, '')), '');
  v_body := nullif(btrim(COALESCE(p_body, '')), '');

  IF v_summary IS NOT NULL AND public.knowledge_text_is_row_ref(v_summary) THEN
    RAISE EXCEPTION 'guidance_invalid_row_ref';
  END IF;
  IF v_body IS NOT NULL AND public.knowledge_text_is_row_ref(v_body) THEN
    RAISE EXCEPTION 'guidance_invalid_row_ref';
  END IF;
  -- Allow saving drafts that still need improvement (reviewer edits); reject empty/refs only.
  IF v_summary IS NULL OR NOT public.knowledge_text_is_meaningful_guidance(v_summary) THEN
    RAISE EXCEPTION 'guidance_required';
  END IF;

  SELECT * INTO v_row FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;
  IF v_row.status NOT IN ('candidate', 'verified', 'stale') THEN
    RAISE EXCEPTION 'guidance_edit_not_allowed';
  END IF;

  v_was_verified := v_row.status = 'verified';

  PERFORM public.knowledge_invalidate_critic(p_knowledge_id, 'guidance_edit');

  UPDATE public.knowledge
  SET
    summary = v_summary,
    body = COALESCE(v_body, body),
    provenance = provenance || jsonb_build_object(
      'guidance_draft', COALESCE(p_draft_meta, '{}'::jsonb) || jsonb_build_object(
        'unverified', true,
        'proposed_at', COALESCE(p_draft_meta->>'proposed_at', now()::text)
      )
    ),
    status = CASE WHEN status = 'verified' THEN 'candidate' ELSE status END,
    reviewed_by = CASE WHEN v_was_verified THEN NULL ELSE reviewed_by END,
    updated_at = now()
  WHERE id = p_knowledge_id
  RETURNING * INTO v_row;

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (
    v_row.id,
    v_row.org_id,
    'human_edit',
    auth.uid(),
    jsonb_build_object(
      'field', 'draft_guidance',
      'via', 'admin_set_knowledge_draft_guidance',
      'draft_meta', COALESCE(p_draft_meta, '{}'::jsonb),
      'critic_invalidated', true
    )
  );

  RETURN v_row;
END;
$$;

-- Store content hash when critic completes.
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
  v_hash text;
BEGIN
  v_unavailable := COALESCE(p_critic_notes, '') ~* 'critic unavailable|default trust retained|no eligible strategy';
  v_passed := CASE
    WHEN v_unavailable THEN false
    WHEN p_critic_passed IS NOT NULL THEN p_critic_passed
    WHEN p_mark_verified THEN true
    ELSE false
  END;
  v_hash := public.knowledge_critic_content_fingerprint(p_knowledge_id);

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
      'critic_result', COALESCE(p_critic_result, '{}'::jsonb),
      'critic_content_hash', v_hash
    ),
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
      'critic_passed', v_passed,
      'model', p_critic_model,
      'provider', p_critic_provider,
      'content_hash', v_hash,
      'result', COALESCE(p_critic_result, '{}'::jsonb)
    )
  );

  RETURN v_row;
END;
$$;

-- Deterministic apply also invalidates critic properly.
CREATE OR REPLACE FUNCTION public.admin_apply_deterministic_draft_guidance(
  p_knowledge_ids uuid[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated integer := 0;
  r record;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  FOR r IN
    SELECT k.id,
      COALESCE(
        NULLIF(btrim(k.attributes->>'action'), ''),
        NULLIF(btrim(k.attributes->>'task'), ''),
        NULLIF(btrim(k.attributes->>'guidance'), ''),
        NULLIF(btrim(k.attributes->>'notes'), '')
      ) AS draft_text,
      CASE
        WHEN public.knowledge_text_is_meaningful_guidance(k.attributes->>'action') THEN 'imported_action'
        WHEN public.knowledge_text_is_meaningful_guidance(k.attributes->>'task') THEN 'imported_task'
        WHEN public.knowledge_text_is_meaningful_guidance(k.attributes->>'guidance') THEN 'imported_guidance'
        ELSE 'imported_notes'
      END AS draft_source
    FROM public.knowledge k
    WHERE k.status = 'candidate'
      AND k.scope = 'platform'
      AND (p_knowledge_ids IS NULL OR k.id = ANY(p_knowledge_ids))
      AND NOT public.knowledge_text_is_meaningful_guidance(k.summary)
      AND NOT public.knowledge_text_is_meaningful_guidance(k.body)
      AND (
        public.knowledge_text_is_meaningful_guidance(k.attributes->>'action')
        OR public.knowledge_text_is_meaningful_guidance(k.attributes->>'task')
        OR public.knowledge_text_is_meaningful_guidance(k.attributes->>'guidance')
        OR public.knowledge_text_is_meaningful_guidance(k.attributes->>'notes')
      )
  LOOP
    IF r.draft_text IS NULL THEN
      CONTINUE;
    END IF;
    PERFORM public.knowledge_invalidate_critic(r.id, 'guidance_edit');
    UPDATE public.knowledge k
    SET
      summary = r.draft_text,
      provenance = k.provenance || jsonb_build_object(
        'guidance_draft', jsonb_build_object(
          'source', r.draft_source,
          'proposed_at', now(),
          'supported_by', jsonb_build_array('attributes.' || replace(r.draft_source, 'imported_', '')),
          'unverified', true
        )
      ),
      updated_at = now()
    WHERE k.id = r.id;
    v_updated := v_updated + 1;
  END LOOP;

  RETURN jsonb_build_object('updated', COALESCE(v_updated, 0));
END;
$$;

-- Repair legacy verified rows that cannot remain publication-ready.
-- Preserve prior verifier identity and timestamp in provenance; do not delete history.
WITH legacy AS (
  SELECT k.id, k.reviewed_by, k.updated_at, k.published_at
  FROM public.knowledge k
  WHERE k.status = 'verified'
    AND (
      NOT public.knowledge_text_is_quality_guidance(
        COALESCE(nullif(btrim(k.summary), ''), nullif(btrim(k.body), '')),
        k.title
      )
      OR NOT public.knowledge_critic_passed(k.id)
      OR NOT public.knowledge_has_authoritative_source(k.id)
      OR (
        COALESCE((k.applicability->>'unscoped')::boolean, false) IS NOT TRUE
        AND (
          jsonb_typeof(COALESCE(k.applicability->'jurisdictions', '[]'::jsonb)) <> 'array'
          OR jsonb_array_length(COALESCE(k.applicability->'jurisdictions', '[]'::jsonb)) = 0
        )
      )
    )
)
UPDATE public.knowledge k
SET
  status = 'candidate',
  reviewed_by = NULL,
  provenance = COALESCE(k.provenance, '{}'::jsonb) || jsonb_build_object(
    'returned_to_review_at', now(),
    'returned_to_review_reason', 'legacy_verification_inconsistent',
    'previous_status', 'verified',
    'previous_reviewed_by', l.reviewed_by,
    'previous_verified_at', COALESCE(
      (
        SELECT e.created_at
        FROM public.knowledge_verification_events e
        WHERE e.knowledge_id = k.id AND e.event_type = 'human_approve'
        ORDER BY e.created_at DESC
        LIMIT 1
      ),
      l.updated_at
    )
  ),
  updated_at = now()
FROM legacy l
WHERE k.id = l.id;

INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
SELECT
  k.id,
  k.org_id,
  'human_edit',
  NULL,
  jsonb_build_object(
    'status', 'candidate',
    'via', 'legacy_verification_repair',
    'reason', 'legacy_verification_inconsistent'
  )
FROM public.knowledge k
WHERE k.provenance->>'returned_to_review_reason' = 'legacy_verification_inconsistent'
  AND (k.provenance->>'returned_to_review_at')::timestamptz > now() - interval '1 minute';

GRANT EXECUTE ON FUNCTION public.knowledge_critic_content_fingerprint(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.knowledge_invalidate_critic(uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
