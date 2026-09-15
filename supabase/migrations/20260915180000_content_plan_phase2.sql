-- Phase 2 Content Tree: parent strategy + content scope + format briefs.
-- Progressive UX (choose → review plan → review content) sits on this model.
-- No Publish / distribution controls in this migration.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

ALTER TABLE public.content_topics
  ADD COLUMN IF NOT EXISTS content_scope text,
  ADD COLUMN IF NOT EXISTS strategy jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'website_blog_social';

ALTER TABLE public.content_topics
  DROP CONSTRAINT IF EXISTS content_topics_content_scope_check;
ALTER TABLE public.content_topics
  ADD CONSTRAINT content_topics_content_scope_check
  CHECK (
    content_scope IS NULL
    OR content_scope = ANY (ARRAY[
      'international_overview'::text,
      'regional_comparison'::text,
      'country_guide'::text,
      'local_guide'::text,
      'property_specific'::text
    ])
  );

ALTER TABLE public.content_topics
  DROP CONSTRAINT IF EXISTS content_topics_workflow_status_check;
ALTER TABLE public.content_topics
  ADD CONSTRAINT content_topics_workflow_status_check
  CHECK (workflow_status = ANY (ARRAY[
    'generating_seo'::text,
    'seo_review'::text,
    'generating_plan'::text,
    'plan_review'::text,
    'generating_brief'::text,
    'brief_review'::text,
    'ready_for_outputs'::text,
    'generating_content'::text,
    'generating_outputs'::text,
    'content_review'::text,
    'output_review'::text,
    'visual_concept_review'::text,
    'generating_final_assets'::text,
    'ready_for_publishing'::text,
    'generation_failed'::text
  ]));

COMMENT ON COLUMN public.content_topics.content_scope IS
  'Parent strategy scope: international_overview | regional_comparison | country_guide | local_guide | property_specific.';
COMMENT ON COLUMN public.content_topics.strategy IS
  'Parent content strategy envelope (forms, exclusions, gaps, supporting pointers). Not factual Knowledge.';
COMMENT ON COLUMN public.content_topics.channel IS
  'Intended launch channel hint for scope inference (e.g. website_blog_social, in_app).';

CREATE TABLE IF NOT EXISTS public.content_topic_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.content_topics(id) ON DELETE CASCADE,
  knowledge_id uuid NOT NULL REFERENCES public.knowledge(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'primary'
    CHECK (role = ANY (ARRAY['primary'::text, 'supporting'::text, 'comparison'::text])),
  sort_order integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, knowledge_id)
);

CREATE INDEX IF NOT EXISTS content_topic_knowledge_topic_idx
  ON public.content_topic_knowledge (topic_id, sort_order);

ALTER TABLE public.content_topic_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_topic_knowledge_admin_all ON public.content_topic_knowledge;
CREATE POLICY content_topic_knowledge_admin_all ON public.content_topic_knowledge
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.content_format_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.content_topics(id) ON DELETE CASCADE,
  form_kind text NOT NULL
    CHECK (form_kind = ANY (ARRAY[
      'informational_article'::text,
      'faq'::text,
      'compliance_checklist'::text,
      'social_post'::text,
      'social_carousel'::text,
      'in_app_tip'::text,
      'regulatory_guide'::text,
      'newsletter'::text
    ])),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY[
      'draft'::text,
      'source_checked'::text,
      'blocked'::text,
      'approved'::text,
      'generating'::text,
      'generated'::text,
      'needs_update'::text,
      'archived'::text
    ])),
  is_primary boolean NOT NULL DEFAULT false,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocker jsonb,
  gap_kind text
    CHECK (gap_kind IS NULL OR gap_kind = ANY (ARRAY[
      'not_yet_researched'::text,
      'not_applicable'::text,
      'applicability_conflict'::text
    ])),
  output_id uuid REFERENCES public.content_outputs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (topic_id, form_kind)
);

CREATE INDEX IF NOT EXISTS content_format_briefs_topic_idx
  ON public.content_format_briefs (topic_id, status);

ALTER TABLE public.content_format_briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_format_briefs_admin_all ON public.content_format_briefs;
CREATE POLICY content_format_briefs_admin_all ON public.content_format_briefs
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

ALTER TABLE public.content_outputs
  DROP CONSTRAINT IF EXISTS content_outputs_output_kind_check;
ALTER TABLE public.content_outputs
  ADD CONSTRAINT content_outputs_output_kind_check
  CHECK (output_kind = ANY (ARRAY[
    'core_article'::text,
    'faq'::text,
    'in_app_tip'::text,
    'newsletter'::text,
    'social_post'::text,
    'social_carousel'::text,
    'compliance_checklist'::text,
    'reel_script'::text
  ]));

ALTER TABLE public.content_outputs
  ADD COLUMN IF NOT EXISTS format_brief_id uuid REFERENCES public.content_format_briefs(id) ON DELETE SET NULL;

-- Drop unique (topic_id, output_kind) if present so carousel + post can coexist as distinct kinds
ALTER TABLE public.content_outputs
  DROP CONSTRAINT IF EXISTS content_outputs_topic_id_output_kind_key;

CREATE UNIQUE INDEX IF NOT EXISTS content_outputs_topic_kind_unique
  ON public.content_outputs (topic_id, output_kind);

-- Backfill primary knowledge links
INSERT INTO public.content_topic_knowledge (topic_id, knowledge_id, role, sort_order)
SELECT t.id, t.knowledge_id, 'primary', 1
FROM public.content_topics t
WHERE t.knowledge_id IS NOT NULL
ON CONFLICT (topic_id, knowledge_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.content_form_to_output_kind(p_form text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_form
    WHEN 'informational_article' THEN 'core_article'
    WHEN 'faq' THEN 'faq'
    WHEN 'compliance_checklist' THEN 'compliance_checklist'
    WHEN 'social_post' THEN 'social_post'
    WHEN 'social_carousel' THEN 'social_carousel'
    WHEN 'in_app_tip' THEN 'in_app_tip'
    WHEN 'regulatory_guide' THEN 'core_article'
    WHEN 'newsletter' THEN 'newsletter'
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- admin_upsert_content_strategy — save plan draft (platform admin)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_upsert_content_strategy(
  p_topic_id uuid,
  p_strategy jsonb,
  p_content_scope text DEFAULT NULL,
  p_channel text DEFAULT NULL,
  p_seo jsonb DEFAULT NULL,
  p_knowledge_ids uuid[] DEFAULT NULL
) RETURNS public.content_topics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.content_topics;
  v_kid uuid;
  v_ord integer := 1;
  v_scope text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT * INTO v_row FROM public.content_topics WHERE id = p_topic_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'topic_not_found';
  END IF;

  v_scope := COALESCE(nullif(trim(p_content_scope), ''), nullif(trim(p_strategy->>'content_scope'), ''), v_row.content_scope);

  UPDATE public.content_topics
  SET
    strategy = COALESCE(p_strategy, strategy),
    content_scope = v_scope,
    channel = COALESCE(nullif(trim(p_channel), ''), channel),
    seo = CASE WHEN p_seo IS NOT NULL THEN p_seo ELSE seo END,
    workflow_status = CASE
      WHEN workflow_status IN ('generating_plan', 'generating_seo') THEN 'plan_review'
      WHEN COALESCE((p_strategy->>'approval_status'), '') = 'approved' THEN workflow_status
      ELSE 'plan_review'
    END,
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_topic_id
  RETURNING * INTO v_row;

  IF p_knowledge_ids IS NOT NULL THEN
    DELETE FROM public.content_topic_knowledge WHERE topic_id = p_topic_id;
    FOREACH v_kid IN ARRAY p_knowledge_ids
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.knowledge k
        WHERE k.id = v_kid AND k.scope = 'platform' AND k.status IN ('verified', 'published')
      ) THEN
        INSERT INTO public.content_topic_knowledge (topic_id, knowledge_id, role, sort_order)
        VALUES (
          p_topic_id,
          v_kid,
          CASE WHEN v_ord = 1 THEN 'primary' ELSE 'supporting' END,
          v_ord
        )
        ON CONFLICT (topic_id, knowledge_id) DO UPDATE
          SET sort_order = EXCLUDED.sort_order, role = EXCLUDED.role;
        IF v_ord = 1 THEN
          UPDATE public.content_topics SET knowledge_id = v_kid WHERE id = p_topic_id;
        END IF;
        v_ord := v_ord + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_content_strategy(uuid, jsonb, text, text, jsonb, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_upsert_content_strategy(uuid, jsonb, text, text, jsonb, uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- admin_approve_content_plan — approve parent; create/update format briefs;
-- source-check; block only conflicted forms. Does not publish.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_approve_content_plan(
  p_topic_id uuid,
  p_strategy jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.content_topics;
  v_strategy jsonb;
  v_forms text[];
  v_primary text;
  v_form text;
  v_exclusions jsonb;
  v_excl jsonb;
  v_excluded boolean;
  v_reason text;
  v_gap text;
  v_brief_id uuid;
  v_eligible text[] := ARRAY[]::text[];
  v_blocked text[] := ARRAY[]::text[];
  v_seo jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT * INTO v_row FROM public.content_topics WHERE id = p_topic_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'topic_not_found';
  END IF;

  v_strategy := COALESCE(p_strategy, v_row.strategy, '{}'::jsonb);
  v_primary := nullif(trim(COALESCE(v_strategy->>'primary_form', '')), '');
  IF v_primary IS NULL THEN
    RAISE EXCEPTION 'primary_form_required';
  END IF;

  IF nullif(trim(COALESCE(v_strategy->>'content_scope', v_row.content_scope, '')), '') IS NULL THEN
    RAISE EXCEPTION 'content_scope_required';
  END IF;

  -- Build form list: primary + derivatives
  v_forms := ARRAY[v_primary];
  IF jsonb_typeof(v_strategy->'derivative_forms') = 'array' THEN
    FOR v_form IN
      SELECT nullif(trim(value #>> '{}'), '')
      FROM jsonb_array_elements(v_strategy->'derivative_forms')
    LOOP
      IF v_form IS NOT NULL AND NOT (v_form = ANY (v_forms)) THEN
        v_forms := array_append(v_forms, v_form);
      END IF;
    END LOOP;
  END IF;

  v_exclusions := COALESCE(v_strategy->'exclusions', '[]'::jsonb);
  v_seo := v_row.seo;
  IF COALESCE(v_seo->>'approval_status', '') <> 'approved' THEN
    v_seo := jsonb_set(
      COALESCE(v_seo, '{}'::jsonb),
      '{approval_status}',
      '"approved"'
    );
    IF v_seo->'approved' IS NULL OR v_seo->'approved' = 'null'::jsonb THEN
      v_seo := jsonb_set(v_seo, '{approved}', COALESCE(v_seo->'current', '{}'::jsonb));
    END IF;
  END IF;

  v_strategy := jsonb_set(v_strategy, '{approval_status}', '"approved"');
  v_strategy := jsonb_set(v_strategy, '{confirmed_at}', to_jsonb(now()::text));

  UPDATE public.content_topics
  SET
    strategy = v_strategy,
    content_scope = COALESCE(nullif(trim(v_strategy->>'content_scope'), ''), content_scope),
    seo = v_seo,
    brief = jsonb_set(
      COALESCE(brief, '{}'::jsonb),
      '{approval_status}',
      '"approved"'
    ),
    workflow_status = 'generating_content',
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_topic_id
  RETURNING * INTO v_row;

  FOREACH v_form IN ARRAY v_forms
  LOOP
    v_excluded := false;
    v_reason := NULL;
    v_gap := NULL;

    FOR v_excl IN SELECT * FROM jsonb_array_elements(v_exclusions)
    LOOP
      IF nullif(trim(COALESCE(v_excl->>'form', v_excl->>'form_kind', '')), '') = v_form THEN
        v_excluded := true;
        v_reason := COALESCE(v_excl->>'reason', 'Excluded from this plan');
        v_gap := COALESCE(v_excl->>'gap_kind', 'not_applicable');
      END IF;
    END LOOP;

    -- Property-specific / in-app tip blocked without property scope
    IF v_form = 'in_app_tip'
       AND COALESCE(v_row.content_scope, v_strategy->>'content_scope', '') <> 'property_specific'
    THEN
      v_excluded := true;
      v_reason := COALESCE(v_reason, 'In-app tip excluded until exact property jurisdiction is known');
      v_gap := COALESCE(v_gap, 'not_applicable');
    END IF;

    INSERT INTO public.content_format_briefs AS b (
      topic_id, form_kind, status, is_primary, body, blocker, gap_kind, updated_at
    ) VALUES (
      p_topic_id,
      v_form,
      CASE WHEN v_excluded THEN 'blocked' ELSE 'source_checked' END,
      v_form = v_primary,
      jsonb_build_object(
        'inherited_from_strategy', true,
        'content_scope', v_row.content_scope
      ),
      CASE WHEN v_excluded THEN jsonb_build_object('reason', v_reason, 'gap_kind', v_gap) ELSE NULL END,
      CASE WHEN v_excluded THEN v_gap ELSE NULL END,
      now()
    )
    ON CONFLICT (topic_id, form_kind) DO UPDATE
      SET
        status = EXCLUDED.status,
        is_primary = EXCLUDED.is_primary,
        blocker = EXCLUDED.blocker,
        gap_kind = EXCLUDED.gap_kind,
        body = b.body || EXCLUDED.body,
        updated_at = now()
    RETURNING id INTO v_brief_id;

    IF v_excluded THEN
      v_blocked := array_append(v_blocked, v_form);
    ELSE
      -- Auto-approve brief when source check passes (progressive disclosure)
      UPDATE public.content_format_briefs
      SET status = 'approved', updated_at = now()
      WHERE id = v_brief_id AND status = 'source_checked';
      v_eligible := array_append(v_eligible, v_form);
    END IF;
  END LOOP;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'content_topic',
    p_topic_id,
    'admin.content_plan.approved',
    jsonb_build_object(
      'eligible_forms', to_jsonb(v_eligible),
      'blocked_forms', to_jsonb(v_blocked),
      'content_scope', v_row.content_scope
    )
  );

  RETURN jsonb_build_object(
    'topic', to_jsonb(v_row),
    'eligible_forms', to_jsonb(v_eligible),
    'blocked_forms', to_jsonb(v_blocked)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_content_plan(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_approve_content_plan(uuid, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- admin_get_content_topic — include strategy links + format briefs
-- ---------------------------------------------------------------------------

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
  v_links jsonb;
  v_briefs jsonb;
  v_all_knowledge_ids uuid[];
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_topic FROM public.content_topics WHERE id = p_topic_id;
  IF v_topic.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_knowledge FROM public.knowledge WHERE id = v_topic.knowledge_id;

  SELECT COALESCE(array_agg(knowledge_id ORDER BY sort_order), ARRAY[v_topic.knowledge_id])
  INTO v_all_knowledge_ids
  FROM public.content_topic_knowledge
  WHERE topic_id = p_topic_id;

  IF v_all_knowledge_ids IS NULL OR array_length(v_all_knowledge_ids, 1) IS NULL THEN
    v_all_knowledge_ids := ARRAY[v_topic.knowledge_id];
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.output_kind), '[]'::jsonb)
  INTO v_outputs
  FROM public.content_outputs o
  WHERE o.topic_id = p_topic_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.created_at), '[]'::jsonb)
  INTO v_sources
  FROM public.knowledge_sources s
  WHERE s.knowledge_id = ANY (v_all_knowledge_ids);

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.sort_order, c.created_at), '[]'::jsonb)
  INTO v_claims
  FROM public.knowledge_claims c
  WHERE c.knowledge_id = ANY (v_all_knowledge_ids);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'knowledge_id', l.knowledge_id,
        'role', l.role,
        'sort_order', l.sort_order,
        'title', k.title,
        'status', k.status,
        'applicability', k.applicability
      )
      ORDER BY l.sort_order
    ),
    '[]'::jsonb
  )
  INTO v_links
  FROM public.content_topic_knowledge l
  JOIN public.knowledge k ON k.id = l.knowledge_id
  WHERE l.topic_id = p_topic_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.is_primary DESC, b.form_kind), '[]'::jsonb)
  INTO v_briefs
  FROM public.content_format_briefs b
  WHERE b.topic_id = p_topic_id;

  RETURN jsonb_build_object(
    'topic', to_jsonb(v_topic),
    'knowledge', to_jsonb(v_knowledge),
    'outputs', v_outputs,
    'sources', v_sources,
    'claims', COALESCE(v_claims, '[]'::jsonb),
    'knowledge_links', COALESCE(v_links, '[]'::jsonb),
    'format_briefs', COALESCE(v_briefs, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_content_topic(uuid) TO authenticated, service_role;

-- Seed primary link on create
CREATE OR REPLACE FUNCTION public.admin_create_content_topic(
  p_knowledge_id uuid,
  p_title text DEFAULT NULL,
  p_allow_duplicate boolean DEFAULT false
) RETURNS public.content_topics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_k public.knowledge;
  v_row public.content_topics;
  v_existing uuid;
  v_jurisdictions jsonb;
  v_scope text;
  v_channel text := 'website_blog_social';
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

  IF NOT COALESCE(p_allow_duplicate, false) THEN
    SELECT id INTO v_existing
    FROM public.content_topics
    WHERE knowledge_id = p_knowledge_id
      AND status <> 'archived'
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RAISE EXCEPTION 'content_topic_exists';
    END IF;
  END IF;

  v_jurisdictions := COALESCE(v_k.applicability->'jurisdictions', '[]'::jsonb);
  IF jsonb_typeof(v_jurisdictions) = 'array' AND jsonb_array_length(v_jurisdictions) = 1 THEN
    v_scope := 'country_guide';
  ELSIF jsonb_typeof(v_jurisdictions) = 'array' AND jsonb_array_length(v_jurisdictions) > 1 THEN
    v_scope := 'regional_comparison';
  ELSIF COALESCE((v_k.applicability->>'unscoped')::boolean, false) THEN
    v_scope := 'international_overview';
  ELSE
    -- Marketing channel default: international overview when jurisdiction is ambiguous
    v_scope := 'international_overview';
  END IF;

  INSERT INTO public.content_topics (
    knowledge_id, title, status, workflow_status, knowledge_version, applicability_snapshot,
    content_scope, channel, strategy, seo, brief, publishing, created_by, updated_by
  ) VALUES (
    p_knowledge_id,
    COALESCE(nullif(trim(p_title), ''), v_k.title),
    'draft',
    'plan_review',
    v_k.version,
    v_k.applicability,
    v_scope,
    v_channel,
    jsonb_build_object(
      'approval_status', 'none',
      'content_scope', v_scope,
      'scope_inferred', true,
      'channel', v_channel
    ),
    jsonb_build_object(
      'approval_status', 'none',
      'stale', false,
      'current', '{}'::jsonb,
      'approved', NULL,
      'versions', '[]'::jsonb
    ),
    jsonb_build_object(
      'approval_status', 'none',
      'stale', false,
      'current', '{}'::jsonb,
      'approved', NULL,
      'versions', '[]'::jsonb
    ),
    jsonb_build_object(
      'channels', jsonb_build_object(
        'app', jsonb_build_object('status', 'not_started'),
        'website_blog', jsonb_build_object('status', 'not_started'),
        'newsletter', jsonb_build_object('status', 'not_started'),
        'instagram', jsonb_build_object('status', 'not_started'),
        'linkedin', jsonb_build_object('status', 'not_started')
      )
    ),
    auth.uid(),
    auth.uid()
  )
  RETURNING * INTO v_row;

  INSERT INTO public.content_topic_knowledge (topic_id, knowledge_id, role, sort_order)
  VALUES (v_row.id, p_knowledge_id, 'primary', 1)
  ON CONFLICT DO NOTHING;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'content_topic',
    v_row.id,
    'admin.content_topic.created',
    jsonb_build_object(
      'knowledge_id', p_knowledge_id,
      'content_scope', v_scope,
      'allow_duplicate', COALESCE(p_allow_duplicate, false)
    )
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_content_topic(uuid, text, boolean) TO authenticated, service_role;
