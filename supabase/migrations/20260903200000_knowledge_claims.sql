-- Knowledge claims: source-backed facts (and explicit unknowns) under a Knowledge item.
-- Reuses knowledge_sources, applicability, critic, verification events, and existing RLS pattern.
-- Does not replace title/summary/body/attributes.

CREATE TABLE IF NOT EXISTS public.knowledge_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id uuid NOT NULL REFERENCES public.knowledge(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE,
  claim_text text NOT NULL CHECK (length(btrim(claim_text)) >= 4 AND length(claim_text) <= 500),
  category text NOT NULL DEFAULT 'other'
    CHECK (category = ANY (ARRAY[
      'obligation','applicability','responsibility','standard','testing',
      'replacement','evidence','exception','consequence','unknown','other'
    ])),
  applicability jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_id uuid REFERENCES public.knowledge_sources(id) ON DELETE SET NULL,
  source_location text,
  verification_status text NOT NULL DEFAULT 'extracted'
    CHECK (verification_status = ANY (ARRAY[
      'extracted','verified','unresolved','unknown','rejected'
    ])),
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  critic_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_claims_knowledge_idx
  ON public.knowledge_claims (knowledge_id, sort_order, created_at);

COMMENT ON TABLE public.knowledge_claims IS
  'Source-backed factual claims (or explicit unknowns) under a Knowledge item. Summary remains the concise representation.';

ALTER TABLE public.knowledge_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_claims_select ON public.knowledge_claims;
CREATE POLICY knowledge_claims_select ON public.knowledge_claims
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge k
      WHERE k.id = knowledge_claims.knowledge_id
        AND (
          (k.scope = 'organisation' AND k.org_id IS NOT NULL AND public.is_org_member(k.org_id))
          OR (k.scope = 'platform' AND k.status = 'published')
        )
    )
  );

DROP POLICY IF EXISTS knowledge_claims_write_org ON public.knowledge_claims;
CREATE POLICY knowledge_claims_write_org ON public.knowledge_claims
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge k
      WHERE k.id = knowledge_claims.knowledge_id
        AND k.scope = 'organisation'
        AND k.org_id IS NOT NULL
        AND public.is_org_owner_or_manager(k.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.knowledge k
      WHERE k.id = knowledge_claims.knowledge_id
        AND k.scope = 'organisation'
        AND k.org_id IS NOT NULL
        AND public.is_org_owner_or_manager(k.org_id)
    )
  );

GRANT SELECT ON public.knowledge_claims TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.knowledge_claims TO authenticated;
GRANT ALL ON public.knowledge_claims TO service_role;

-- ---------------------------------------------------------------------------
-- Insert claims (service + admin RPCs). Never invents facts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_knowledge_claims(
  p_knowledge_id uuid,
  p_claims jsonb DEFAULT '[]'::jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_k public.knowledge;
  v_item jsonb;
  v_text text;
  v_category text;
  v_status text;
  v_established boolean;
  v_order integer := 0;
  v_count integer := 0;
  v_source uuid;
BEGIN
  SELECT * INTO v_k FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_k.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  IF p_claims IS NULL OR jsonb_typeof(p_claims) <> 'array' THEN
    RETURN 0;
  END IF;

  SELECT s.id INTO v_source
  FROM public.knowledge_sources s
  WHERE s.knowledge_id = p_knowledge_id
  ORDER BY CASE WHEN s.source_type = 'url' THEN 0 ELSE 1 END, s.created_at
  LIMIT 1;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_claims)
  LOOP
    IF v_count >= 40 THEN
      EXIT;
    END IF;

    v_text := nullif(btrim(COALESCE(v_item->>'claim_text', v_item->>'text', '')), '');
    IF v_text IS NULL OR length(v_text) < 4 THEN
      CONTINUE;
    END IF;

    v_established := COALESCE((v_item->>'established')::boolean, true);
    v_status := lower(btrim(COALESCE(v_item->>'verification_status', '')));
    IF NOT v_established THEN
      v_status := 'unknown';
    ELSIF v_status NOT IN ('extracted','verified','unresolved','unknown','rejected') THEN
      v_status := 'extracted';
    END IF;

    v_category := lower(btrim(COALESCE(v_item->>'category', 'other')));
    IF v_status = 'unknown' THEN
      v_category := 'unknown';
    ELSIF v_category NOT IN (
      'obligation','applicability','responsibility','standard','testing',
      'replacement','evidence','exception','consequence','unknown','other'
    ) THEN
      v_category := 'other';
    END IF;

    INSERT INTO public.knowledge_claims (
      knowledge_id, org_id, claim_text, category, applicability, source_id,
      source_location, verification_status, confidence, critic_result, sort_order
    ) VALUES (
      v_k.id,
      v_k.org_id,
      left(v_text, 500),
      v_category,
      CASE
        WHEN jsonb_typeof(v_item->'applicability') = 'object' THEN v_item->'applicability'
        ELSE '{}'::jsonb
      END,
      COALESCE(
        NULLIF(v_item->>'source_id', '')::uuid,
        v_source
      ),
      nullif(left(btrim(COALESCE(v_item->>'source_location', '')), 240), ''),
      v_status,
      CASE
        WHEN (v_item->>'confidence') ~ '^[0-9]+(\.[0-9]+)?$' THEN
          LEAST(1, GREATEST(0, (v_item->>'confidence')::numeric))
        ELSE NULL
      END,
      CASE
        WHEN jsonb_typeof(v_item->'critic_result') = 'object' THEN v_item->'critic_result'
        ELSE '{}'::jsonb
      END,
      v_order
    );

    v_order := v_order + 1;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_knowledge_claims(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_knowledge_claims(uuid, jsonb) TO service_role;

-- Derive claims from existing attributes when intake did not send a claims array.
CREATE OR REPLACE FUNCTION public.knowledge_claims_from_attributes(p_attributes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v jsonb := '[]'::jsonb;
  v_map jsonb := jsonb_build_object(
    'legal_status', 'obligation',
    'applies_when', 'applicability',
    'action', 'obligation',
    'frequency', 'testing',
    'timing', 'testing',
    'evidence', 'evidence',
    'responsible_party', 'responsibility',
    'professional_required', 'responsibility',
    'risk_or_consequence', 'consequence',
    'insurance_relevance', 'consequence',
    'local_variation', 'exception'
  );
  v_key text;
  v_val text;
BEGIN
  IF p_attributes IS NULL OR jsonb_typeof(p_attributes) <> 'object' THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(v_map)
  LOOP
    v_val := nullif(btrim(COALESCE(p_attributes->>v_key, '')), '');
    IF v_val IS NULL OR length(v_val) < 4 THEN
      CONTINUE;
    END IF;
    v := v || jsonb_build_array(jsonb_build_object(
      'claim_text', left(v_val, 500),
      'category', v_map->>v_key,
      'verification_status', 'extracted'
    ));
  END LOOP;

  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.knowledge_claims_from_attributes(jsonb) TO authenticated, service_role;

-- Stamp critic result onto extracted claims (does not auto-verify).
CREATE OR REPLACE FUNCTION public.apply_knowledge_claim_critic(
  p_knowledge_id uuid,
  p_critic_result jsonb,
  p_passed boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.knowledge_claims
  SET
    critic_result = COALESCE(p_critic_result, '{}'::jsonb),
    verification_status = CASE
      WHEN verification_status IN ('unknown', 'rejected', 'verified') THEN verification_status
      WHEN NOT COALESCE(p_passed, false) THEN 'unresolved'
      ELSE verification_status
    END,
    updated_at = now()
  WHERE knowledge_id = p_knowledge_id
    AND verification_status IN ('extracted', 'unresolved');
END;
$$;

REVOKE ALL ON FUNCTION public.apply_knowledge_claim_critic(uuid, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_knowledge_claim_critic(uuid, jsonb, boolean) TO service_role;

-- ---------------------------------------------------------------------------
-- Human verify promotes source-backed extracted claims; unknowns stay unknown.
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
  v_prov jsonb;
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

  v_prov := COALESCE(v_row.provenance, '{}'::jsonb);
  IF p_status = 'verified' AND v_prov ? 'guidance_draft' THEN
    v_prov := jsonb_set(
      v_prov,
      '{guidance_draft,unverified}',
      'false'::jsonb,
      true
    );
  END IF;

  UPDATE public.knowledge
  SET
    status = p_status,
    reviewed_by = CASE
      WHEN p_status IN ('verified', 'published', 'archived', 'stale') THEN auth.uid()
      ELSE reviewed_by
    END,
    published_at = CASE WHEN p_status = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
    provenance = v_prov,
    updated_at = now()
  WHERE id = p_knowledge_id
  RETURNING * INTO v_row;

  IF p_status IN ('verified', 'published') THEN
    UPDATE public.knowledge_claims
    SET
      verification_status = 'verified',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
    WHERE knowledge_id = p_knowledge_id
      AND verification_status = 'extracted';
  END IF;

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

-- ---------------------------------------------------------------------------
-- Detail + content topic include claims
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_knowledge_detail(p_knowledge_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_knowledge public.knowledge;
  v_sources jsonb;
  v_events jsonb;
  v_claims jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_knowledge FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_knowledge.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.created_at), '[]'::jsonb)
  INTO v_sources
  FROM public.knowledge_sources s
  WHERE s.knowledge_id = p_knowledge_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM public.knowledge_verification_events e
  WHERE e.knowledge_id = p_knowledge_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.sort_order, c.created_at), '[]'::jsonb)
  INTO v_claims
  FROM public.knowledge_claims c
  WHERE c.knowledge_id = p_knowledge_id;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'knowledge',
    p_knowledge_id,
    'admin.knowledge.detail_viewed',
    '{}'::jsonb
  );

  RETURN jsonb_build_object(
    'knowledge', to_jsonb(v_knowledge),
    'sources', v_sources,
    'verification_events', v_events,
    'claims', v_claims
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_content_topic(p_topic_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_topic public.content_topics;
  v_knowledge public.knowledge;
  v_outputs jsonb;
  v_sources jsonb;
  v_claims jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_topic FROM public.content_topics WHERE id = p_topic_id;
  IF v_topic.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_knowledge FROM public.knowledge WHERE id = v_topic.knowledge_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.output_kind), '[]'::jsonb)
  INTO v_outputs
  FROM public.content_outputs o
  WHERE o.topic_id = p_topic_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.created_at), '[]'::jsonb)
  INTO v_sources
  FROM public.knowledge_sources s
  WHERE s.knowledge_id = v_topic.knowledge_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.sort_order, c.created_at), '[]'::jsonb)
  INTO v_claims
  FROM public.knowledge_claims c
  WHERE c.knowledge_id = v_topic.knowledge_id;

  RETURN jsonb_build_object(
    'topic', to_jsonb(v_topic),
    'knowledge', to_jsonb(v_knowledge),
    'outputs', v_outputs,
    'sources', v_sources,
    'claims', COALESCE(v_claims, '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Bulk create: persist extractor/attribute claims after sources exist
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
  v_claims jsonb;
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

    v_claims := v_item->'claims';
    IF v_claims IS NULL OR jsonb_typeof(v_claims) <> 'array' OR jsonb_array_length(v_claims) = 0 THEN
      v_claims := public.knowledge_claims_from_attributes(v_attributes);
    END IF;
    PERFORM public.insert_knowledge_claims(v_row.id, v_claims);

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

-- Existing Knowledge: preserve attributes as extracted claims (no invention).
INSERT INTO public.knowledge_claims (
  knowledge_id, org_id, claim_text, category, applicability, verification_status, sort_order
)
SELECT
  k.id,
  k.org_id,
  left(btrim(item.claim_text), 500),
  item.category,
  '{}'::jsonb,
  'extracted',
  item.sort_order
FROM public.knowledge k
CROSS JOIN LATERAL (
  SELECT
    (c->>'claim_text') AS claim_text,
    (c->>'category') AS category,
    (ordinality - 1) AS sort_order
  FROM jsonb_array_elements(public.knowledge_claims_from_attributes(k.attributes))
    WITH ORDINALITY AS t(c, ordinality)
) item
WHERE NOT EXISTS (
  SELECT 1 FROM public.knowledge_claims existing WHERE existing.knowledge_id = k.id
)
AND item.claim_text IS NOT NULL
AND length(btrim(item.claim_text)) >= 4;
