-- Knowledge applicability + Intake (Upload + Manual) + Content Tree.
-- Platform-admin intake never publishes; critic is invoked by the app after create.
-- Canonical names match baseline: knowledge_sources, knowledge_verification_events,
-- is_platform_admin(), create_knowledge_candidate, admin_upsert_platform_knowledge.

-- ---------------------------------------------------------------------------
-- 0. Applicability
-- ---------------------------------------------------------------------------
ALTER TABLE public.knowledge
  ADD COLUMN IF NOT EXISTS applicability jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.knowledge.applicability IS
  '{ jurisdictions: string[], regions: string[], languages: string[], audiences: string[], unscoped?: boolean }. Empty = not yet scoped.';

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

  v_audiences := ARRAY(
    SELECT DISTINCT lower(trim(x))
    FROM jsonb_array_elements_text(COALESCE(v->'audiences', '[]'::jsonb)) AS t(x)
    WHERE length(trim(x)) > 0
  );

  IF EXISTS (
    SELECT 1 FROM unnest(v_audiences) a
    WHERE a NOT IN ('owner', 'manager', 'field', 'tenant', 'public')
  ) THEN
    RAISE EXCEPTION 'invalid_applicability_audience';
  END IF;

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

-- ---------------------------------------------------------------------------
-- Intake batches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_intake_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_filename text,
  source_mime text,
  storage_bucket text,
  storage_path text,
  row_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'previewed'
    CHECK (status = ANY (ARRAY['previewed'::text, 'created'::text, 'failed'::text, 'archived'::text])),
  column_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_intake_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_intake_batches_admin_all ON public.knowledge_intake_batches;
CREATE POLICY knowledge_intake_batches_admin_all ON public.knowledge_intake_batches
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Content Tree
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id uuid NOT NULL REFERENCES public.knowledge(id) ON DELETE RESTRICT,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])),
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  creative jsonb NOT NULL DEFAULT '{}'::jsonb,
  publishing jsonb NOT NULL DEFAULT '{}'::jsonb,
  knowledge_version integer NOT NULL DEFAULT 1,
  applicability_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  upstream_hash text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS content_topics_one_active_per_knowledge
  ON public.content_topics (knowledge_id)
  WHERE status <> 'archived';

CREATE TABLE IF NOT EXISTS public.content_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.content_topics(id) ON DELETE CASCADE,
  output_kind text NOT NULL
    CHECK (output_kind = ANY (ARRAY['core_article'::text, 'faq'::text, 'in_app_tip'::text])),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft'::text, 'needs_review'::text, 'approved'::text, 'rejected'::text, 'needs_update'::text, 'archived'::text])),
  title text,
  body text,
  structured jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  upstream_hash text,
  version integer NOT NULL DEFAULT 1,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, output_kind)
);

ALTER TABLE public.content_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_topics_admin_all ON public.content_topics;
CREATE POLICY content_topics_admin_all ON public.content_topics
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS content_outputs_admin_all ON public.content_outputs;
CREATE POLICY content_outputs_admin_all ON public.content_outputs
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- create_knowledge_candidate (+ applicability)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_knowledge_candidate(text, uuid, text, text, text, text, jsonb, jsonb, integer, numeric, uuid);

CREATE OR REPLACE FUNCTION public.create_knowledge_candidate(
  p_scope text,
  p_org_id uuid,
  p_title text,
  p_summary text,
  p_body text,
  p_source_kind text,
  p_content jsonb DEFAULT '{}'::jsonb,
  p_provenance jsonb DEFAULT '{}'::jsonb,
  p_cohort_size integer DEFAULT NULL::integer,
  p_trust_score numeric DEFAULT NULL::numeric,
  p_created_by uuid DEFAULT NULL::uuid,
  p_applicability jsonb DEFAULT '{}'::jsonb
) RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge;
BEGIN
  IF p_scope = 'platform' AND p_org_id IS NOT NULL THEN
    RAISE EXCEPTION 'platform_org_must_be_null';
  END IF;
  IF p_scope = 'organisation' AND p_org_id IS NULL THEN
    RAISE EXCEPTION 'org_required';
  END IF;

  INSERT INTO public.knowledge (
    scope, status, org_id, title, summary, body, content, source_kind,
    provenance, cohort_size, trust_score, created_by, applicability
  ) VALUES (
    p_scope, 'candidate', p_org_id, p_title, p_summary, p_body,
    COALESCE(p_content, '{}'::jsonb), p_source_kind,
    COALESCE(p_provenance, '{}'::jsonb), p_cohort_size, p_trust_score, p_created_by,
    public.normalize_knowledge_applicability(p_applicability)
  )
  RETURNING * INTO v_row;

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (
    v_row.id, p_org_id, 'candidate_created', p_created_by,
    jsonb_build_object('source_kind', p_source_kind, 'via', 'create_knowledge_candidate')
  );

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_upsert_platform_knowledge (+ applicability; bump version on edit)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_upsert_platform_knowledge(text, text, text, text, jsonb, jsonb, integer, uuid, text);

CREATE OR REPLACE FUNCTION public.admin_upsert_platform_knowledge(
  p_title text,
  p_summary text DEFAULT NULL::text,
  p_body text DEFAULT NULL::text,
  p_source_kind text DEFAULT 'filla_curated'::text,
  p_content jsonb DEFAULT '{}'::jsonb,
  p_provenance jsonb DEFAULT '{}'::jsonb,
  p_cohort_size integer DEFAULT NULL::integer,
  p_id uuid DEFAULT NULL::uuid,
  p_status text DEFAULT 'candidate'::text,
  p_applicability jsonb DEFAULT '{}'::jsonb
) RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge;
  v_applicability jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  IF p_source_kind NOT IN ('filla_curated', 'community_brain') THEN
    RAISE EXCEPTION 'invalid_platform_source_kind';
  END IF;

  v_applicability := public.normalize_knowledge_applicability(p_applicability);

  IF p_id IS NOT NULL THEN
    UPDATE public.knowledge
    SET
      title = p_title,
      summary = p_summary,
      body = p_body,
      content = COALESCE(p_content, content),
      provenance = COALESCE(p_provenance, provenance),
      cohort_size = COALESCE(p_cohort_size, cohort_size),
      source_kind = p_source_kind,
      applicability = v_applicability,
      version = version + 1,
      updated_at = now()
    WHERE id = p_id AND scope = 'platform'
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'knowledge_not_found';
    END IF;

    INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
    VALUES (v_row.id, NULL, 'human_edit', auth.uid(), jsonb_build_object('title', p_title));
  ELSE
    INSERT INTO public.knowledge (
      scope, status, org_id, title, summary, body, content, source_kind,
      provenance, cohort_size, created_by, applicability
    ) VALUES (
      'platform', COALESCE(p_status, 'candidate'), NULL, p_title, p_summary, p_body,
      COALESCE(p_content, '{}'::jsonb), p_source_kind,
      COALESCE(p_provenance, '{}'::jsonb), p_cohort_size, auth.uid(), v_applicability
    )
    RETURNING * INTO v_row;

    INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
    VALUES (v_row.id, NULL, 'candidate_created', auth.uid(), jsonb_build_object('source_kind', p_source_kind));
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'knowledge',
    v_row.id,
    'admin.knowledge.upserted',
    jsonb_build_object('title', p_title)
  );

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- upsert_org_knowledge (+ applicability)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_org_knowledge(uuid, text, text, text, text, jsonb, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.upsert_org_knowledge(
  p_org_id uuid,
  p_title text,
  p_summary text DEFAULT NULL::text,
  p_body text DEFAULT NULL::text,
  p_source_kind text DEFAULT 'org_upload'::text,
  p_content jsonb DEFAULT '{}'::jsonb,
  p_provenance jsonb DEFAULT '{}'::jsonb,
  p_id uuid DEFAULT NULL::uuid,
  p_applicability jsonb DEFAULT '{}'::jsonb
) RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge;
  v_applicability jsonb;
BEGIN
  IF NOT public.is_org_owner_or_manager(p_org_id) THEN
    RAISE EXCEPTION 'not_org_manager';
  END IF;

  IF p_source_kind NOT IN ('org_upload', 'operational_discovery', 'filla_curated') THEN
    RAISE EXCEPTION 'invalid_source_kind_for_org';
  END IF;

  v_applicability := public.normalize_knowledge_applicability(p_applicability);

  IF p_id IS NOT NULL THEN
    UPDATE public.knowledge
    SET
      title = p_title,
      summary = p_summary,
      body = p_body,
      content = COALESCE(p_content, '{}'::jsonb),
      provenance = COALESCE(p_provenance, provenance),
      applicability = v_applicability,
      version = version + 1,
      updated_at = now()
    WHERE id = p_id
      AND scope = 'organisation'
      AND org_id = p_org_id
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'knowledge_not_found';
    END IF;

    INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
    VALUES (v_row.id, p_org_id, 'human_edit', auth.uid(), jsonb_build_object('title', p_title));

    RETURN v_row;
  END IF;

  INSERT INTO public.knowledge (
    scope, status, org_id, title, summary, body, content, source_kind, provenance, created_by, applicability
  ) VALUES (
    'organisation', 'candidate', p_org_id, p_title, p_summary, p_body,
    COALESCE(p_content, '{}'::jsonb), p_source_kind, COALESCE(p_provenance, '{}'::jsonb), auth.uid(),
    v_applicability
  )
  RETURNING * INTO v_row;

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (v_row.id, p_org_id, 'candidate_created', auth.uid(), jsonb_build_object('source_kind', p_source_kind));

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin detail (knowledge + sources + verification events)
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
    'verification_events', v_events
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_add_knowledge_source(
  p_knowledge_id uuid,
  p_source_type text,
  p_label text DEFAULT NULL,
  p_url text DEFAULT NULL,
  p_attachment_id uuid DEFAULT NULL,
  p_external_ref text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.knowledge_sources
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_k public.knowledge;
  v_row public.knowledge_sources;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  IF p_source_type NOT IN (
    'attachment', 'url', 'compliance_document', 'intake_item',
    'brain_pattern', 'message', 'manual', 'other'
  ) THEN
    RAISE EXCEPTION 'invalid_source_type';
  END IF;

  SELECT * INTO v_k FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_k.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  INSERT INTO public.knowledge_sources (
    knowledge_id, source_type, label, url, attachment_id, external_ref, metadata
  ) VALUES (
    p_knowledge_id, p_source_type, p_label, p_url, p_attachment_id, p_external_ref,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Intake batch + bulk candidates
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_knowledge_intake_batch(
  p_source_filename text,
  p_source_mime text DEFAULT NULL,
  p_storage_bucket text DEFAULT NULL,
  p_storage_path text DEFAULT NULL,
  p_row_count integer DEFAULT 0,
  p_column_mapping jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.knowledge_intake_batches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge_intake_batches;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  INSERT INTO public.knowledge_intake_batches (
    created_by, source_filename, source_mime, storage_bucket, storage_path,
    row_count, column_mapping, metadata, status
  ) VALUES (
    auth.uid(), p_source_filename, p_source_mime, p_storage_bucket, p_storage_path,
    COALESCE(p_row_count, 0), COALESCE(p_column_mapping, '{}'::jsonb),
    COALESCE(p_metadata, '{}'::jsonb), 'previewed'
  )
  RETURNING * INTO v_row;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'knowledge_intake_batch',
    v_row.id,
    'admin.knowledge.intake_batch_created',
    jsonb_build_object('filename', p_source_filename, 'row_count', p_row_count)
  );

  RETURN v_row;
END;
$$;

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
  v_max integer := 200;
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

    v_applicability := public.normalize_knowledge_applicability(
      COALESCE(v_item->'applicability', '{}'::jsonb)
    );

    IF (
      COALESCE(jsonb_array_length(v_applicability->'jurisdictions'), 0) = 0
      AND COALESCE((v_applicability->>'unscoped')::boolean, false) IS NOT TRUE
    ) THEN
      RAISE EXCEPTION 'applicability_required_for_candidate';
    END IF;

    INSERT INTO public.knowledge (
      scope, status, org_id, title, summary, body, content, source_kind,
      provenance, created_by, applicability
    ) VALUES (
      'platform',
      'candidate',
      NULL,
      v_title,
      nullif(trim(COALESCE(v_item->>'summary', '')), ''),
      nullif(trim(COALESCE(v_item->>'body', '')), ''),
      COALESCE(v_item->'content', '{}'::jsonb),
      'filla_curated',
      jsonb_build_object(
        'intake_batch_id', p_batch_id,
        'source_row', v_item->'source_row',
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

    INSERT INTO public.knowledge_sources (
      knowledge_id, source_type, label, external_ref, metadata
    ) VALUES (
      v_row.id,
      CASE WHEN v_batch.storage_path IS NOT NULL THEN 'attachment' ELSE 'other' END,
      COALESCE(v_batch.source_filename, 'Intake upload'),
      p_batch_id::text,
      jsonb_build_object(
        'intake_batch_id', p_batch_id,
        'storage_bucket', v_batch.storage_bucket,
        'storage_path', v_batch.storage_path,
        'source_row', v_item->'source_row',
        'source_mime', v_batch.source_mime
      )
    );

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

-- ---------------------------------------------------------------------------
-- Content Tree RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_content_topics(p_status text DEFAULT NULL)
RETURNS SETOF public.content_topics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.*
  FROM public.content_topics t
  WHERE (p_status IS NULL OR t.status = p_status)
  ORDER BY t.updated_at DESC
  LIMIT 200;
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

  RETURN jsonb_build_object(
    'topic', to_jsonb(v_topic),
    'knowledge', to_jsonb(v_knowledge),
    'outputs', v_outputs,
    'sources', v_sources
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_content_topic(
  p_knowledge_id uuid,
  p_title text DEFAULT NULL
) RETURNS public.content_topics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_k public.knowledge;
  v_row public.content_topics;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT * INTO v_k FROM public.knowledge WHERE id = p_knowledge_id AND scope = 'platform';
  IF v_k.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  IF v_k.status NOT IN ('verified', 'published') THEN
    RAISE EXCEPTION 'knowledge_must_be_verified_or_published';
  END IF;

  INSERT INTO public.content_topics (
    knowledge_id, title, status, knowledge_version, applicability_snapshot,
    publishing, created_by, updated_by
  ) VALUES (
    p_knowledge_id,
    COALESCE(nullif(trim(p_title), ''), v_k.title),
    'draft',
    v_k.version,
    v_k.applicability,
    jsonb_build_object(
      'channels', jsonb_build_object(
        'app', jsonb_build_object('status', 'not_started'),
        'website_blog', jsonb_build_object('status', 'not_started'),
        'newsletter', jsonb_build_object('status', 'not_started'),
        'instagram', jsonb_build_object('status', 'not_started'),
        'linkedin', jsonb_build_object('status', 'not_started'),
        'google_ads', jsonb_build_object('status', 'not_started'),
        'meta_ads', jsonb_build_object('status', 'not_started')
      )
    ),
    auth.uid(),
    auth.uid()
  )
  RETURNING * INTO v_row;

  INSERT INTO public.content_outputs (topic_id, output_kind, status)
  VALUES
    (v_row.id, 'core_article', 'draft'),
    (v_row.id, 'faq', 'draft'),
    (v_row.id, 'in_app_tip', 'draft');

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'content_topic',
    v_row.id,
    'admin.content_topic.created',
    jsonb_build_object('knowledge_id', p_knowledge_id)
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_content_topic_stage(
  p_topic_id uuid,
  p_seo jsonb DEFAULT NULL,
  p_brief jsonb DEFAULT NULL,
  p_creative jsonb DEFAULT NULL,
  p_publishing jsonb DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_status text DEFAULT NULL
) RETURNS public.content_topics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.content_topics;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  UPDATE public.content_topics
  SET
    title = COALESCE(nullif(trim(p_title), ''), title),
    status = COALESCE(p_status, status),
    seo = COALESCE(p_seo, seo),
    brief = COALESCE(p_brief, brief),
    creative = COALESCE(p_creative, creative),
    publishing = COALESCE(p_publishing, publishing),
    updated_by = auth.uid(),
    updated_at = now(),
    upstream_hash = md5(
      COALESCE(p_seo, seo)::text || COALESCE(p_brief, brief)::text || applicability_snapshot::text
    )
  WHERE id = p_topic_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'content_topic_not_found';
  END IF;

  IF p_seo IS NOT NULL OR p_brief IS NOT NULL THEN
    UPDATE public.content_outputs
    SET status = 'needs_update', updated_at = now()
    WHERE topic_id = p_topic_id
      AND status IN ('approved', 'needs_review', 'draft');
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_content_output(
  p_topic_id uuid,
  p_output_kind text,
  p_title text DEFAULT NULL,
  p_body text DEFAULT NULL,
  p_structured jsonb DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_provenance jsonb DEFAULT NULL
) RETURNS public.content_outputs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing public.content_outputs;
  v_row public.content_outputs;
  v_next_status text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  IF p_output_kind NOT IN ('core_article', 'faq', 'in_app_tip') THEN
    RAISE EXCEPTION 'invalid_output_kind';
  END IF;

  SELECT * INTO v_existing
  FROM public.content_outputs
  WHERE topic_id = p_topic_id AND output_kind = p_output_kind;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'content_output_not_found';
  END IF;

  IF v_existing.status = 'approved'
     AND p_body IS NOT NULL
     AND p_body IS DISTINCT FROM v_existing.body
     AND COALESCE(p_status, v_existing.status) = 'approved' THEN
    RAISE EXCEPTION 'cannot_overwrite_approved_output';
  END IF;

  v_next_status := COALESCE(p_status, v_existing.status);

  UPDATE public.content_outputs
  SET
    title = COALESCE(p_title, title),
    body = COALESCE(p_body, body),
    structured = COALESCE(p_structured, structured),
    status = v_next_status,
    provenance = COALESCE(p_provenance, provenance),
    version = CASE
      WHEN p_body IS NOT NULL AND p_body IS DISTINCT FROM v_existing.body THEN version + 1
      ELSE version
    END,
    approved_by = CASE WHEN v_next_status = 'approved' THEN auth.uid() ELSE approved_by END,
    approved_at = CASE WHEN v_next_status = 'approved' THEN now() ELSE approved_at END,
    updated_at = now()
  WHERE id = v_existing.id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_content_output_status(
  p_output_id uuid,
  p_status text
) RETURNS public.content_outputs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.content_outputs;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  IF p_status NOT IN ('draft', 'needs_review', 'approved', 'rejected', 'needs_update', 'archived') THEN
    RAISE EXCEPTION 'invalid_output_status';
  END IF;

  UPDATE public.content_outputs
  SET
    status = p_status,
    approved_by = CASE WHEN p_status = 'approved' THEN auth.uid() ELSE approved_by END,
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE approved_at END,
    updated_at = now()
  WHERE id = p_output_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'content_output_not_found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_content_outputs_stale_for_knowledge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.scope = 'platform' AND (
    NEW.body IS DISTINCT FROM OLD.body
    OR NEW.summary IS DISTINCT FROM OLD.summary
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.applicability IS DISTINCT FROM OLD.applicability
    OR NEW.version IS DISTINCT FROM OLD.version
  ) THEN
    UPDATE public.content_topics t
    SET
      knowledge_version = NEW.version,
      applicability_snapshot = NEW.applicability,
      updated_at = now()
    WHERE t.knowledge_id = NEW.id
      AND t.status <> 'archived';

    UPDATE public.content_outputs o
    SET status = 'needs_update', updated_at = now()
    FROM public.content_topics t
    WHERE o.topic_id = t.id
      AND t.knowledge_id = NEW.id
      AND o.status IN ('approved', 'needs_review', 'draft');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_knowledge_content_stale ON public.knowledge;
CREATE TRIGGER trg_knowledge_content_stale
  AFTER UPDATE ON public.knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_content_outputs_stale_for_knowledge();

-- ---------------------------------------------------------------------------
-- Storage bucket for platform knowledge intake
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-intake',
  'knowledge-intake',
  false,
  52428800,
  ARRAY[
    'text/csv',
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Platform admins read knowledge intake" ON storage.objects;
CREATE POLICY "Platform admins read knowledge intake"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge-intake' AND public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins upload knowledge intake" ON storage.objects;
CREATE POLICY "Platform admins upload knowledge intake"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-intake'
    AND public.is_platform_admin()
    AND split_part(name, '/', 1) = 'platform'
  );

DROP POLICY IF EXISTS "Platform admins delete knowledge intake" ON storage.objects;
CREATE POLICY "Platform admins delete knowledge intake"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'knowledge-intake' AND public.is_platform_admin());

-- Grants
GRANT EXECUTE ON FUNCTION public.normalize_knowledge_applicability(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_knowledge_candidate(text, uuid, text, text, text, text, jsonb, jsonb, integer, numeric, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_platform_knowledge(text, text, text, text, jsonb, jsonb, integer, uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_org_knowledge(uuid, text, text, text, text, jsonb, jsonb, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_knowledge_detail(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_add_knowledge_source(uuid, text, text, text, uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_knowledge_intake_batch(text, text, text, text, integer, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_bulk_create_platform_knowledge_candidates(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_content_topics(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_content_topic(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_content_topic(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_content_topic_stage(uuid, jsonb, jsonb, jsonb, jsonb, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_content_output(uuid, text, text, text, jsonb, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_content_output_status(uuid, text) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON public.knowledge_intake_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.content_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.content_outputs TO authenticated;
GRANT ALL ON public.knowledge_intake_batches TO service_role;
GRANT ALL ON public.content_topics TO service_role;
GRANT ALL ON public.content_outputs TO service_role;
