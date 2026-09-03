-- Content Tree sequential workflow: workflow_status, stage envelopes, on-demand outputs.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_topics
  ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'seo_review';

ALTER TABLE public.content_topics
  DROP CONSTRAINT IF EXISTS content_topics_workflow_status_check;

ALTER TABLE public.content_topics
  ADD CONSTRAINT content_topics_workflow_status_check
  CHECK (workflow_status = ANY (ARRAY[
    'generating_seo'::text,
    'seo_review'::text,
    'generating_brief'::text,
    'brief_review'::text,
    'ready_for_outputs'::text,
    'generating_outputs'::text,
    'output_review'::text,
    'visual_concept_review'::text,
    'generating_final_assets'::text,
    'ready_for_publishing'::text,
    'generation_failed'::text
  ]));

-- Allow multiple topics per knowledge when admin explicitly creates another angle.
DROP INDEX IF EXISTS public.content_topics_one_active_per_knowledge;

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
    'reel_script'::text
  ]));

-- Migrate legacy flat seo/brief blobs into stage envelopes.
UPDATE public.content_topics t
SET seo = jsonb_build_object(
  'approval_status',
    CASE
      WHEN COALESCE(t.seo->>'approval_status', '') IN ('approved', 'pending', 'rejected', 'none')
        THEN t.seo->>'approval_status'
      WHEN COALESCE(t.seo->>'primary_keyword', '') <> '' THEN 'pending'
      ELSE 'none'
    END,
  'stale', false,
  'current', CASE
    WHEN t.seo ? 'approval_status' THEN COALESCE(t.seo->'current', '{}'::jsonb)
    ELSE COALESCE(t.seo, '{}'::jsonb)
  END,
  'approved', CASE
    WHEN t.seo ? 'approval_status' THEN t.seo->'approved'
    ELSE NULL
  END,
  'versions', CASE
    WHEN t.seo ? 'versions' THEN COALESCE(t.seo->'versions', '[]'::jsonb)
    ELSE '[]'::jsonb
  END
)
WHERE t.seo IS NOT NULL;

UPDATE public.content_topics t
SET brief = jsonb_build_object(
  'approval_status',
    CASE
      WHEN COALESCE(t.brief->>'approval_status', '') IN ('approved', 'pending', 'rejected', 'none')
        THEN t.brief->>'approval_status'
      WHEN COALESCE(t.brief->>'title', '') <> '' OR COALESCE(t.brief->>'angle', '') <> '' THEN 'pending'
      ELSE 'none'
    END,
  'stale', false,
  'current', CASE
    WHEN t.brief ? 'approval_status' THEN COALESCE(t.brief->'current', '{}'::jsonb)
    ELSE COALESCE(t.brief, '{}'::jsonb)
  END,
  'approved', CASE
    WHEN t.brief ? 'approval_status' THEN t.brief->'approved'
    ELSE NULL
  END,
  'versions', CASE
    WHEN t.brief ? 'versions' THEN COALESCE(t.brief->'versions', '[]'::jsonb)
    ELSE '[]'::jsonb
  END
)
WHERE t.brief IS NOT NULL;

UPDATE public.content_topics t
SET workflow_status = CASE
  WHEN COALESCE(t.brief->>'approval_status', 'none') = 'approved' THEN 'ready_for_outputs'
  WHEN COALESCE(t.seo->>'approval_status', 'none') = 'approved' THEN 'brief_review'
  WHEN COALESCE(t.seo->>'approval_status', 'none') = 'pending' THEN 'seo_review'
  ELSE 'seo_review'
END
WHERE t.workflow_status = 'seo_review';

-- ---------------------------------------------------------------------------
-- admin_create_content_topic — no empty outputs; duplicate guard
-- ---------------------------------------------------------------------------
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

  INSERT INTO public.content_topics (
    knowledge_id, title, status, workflow_status, knowledge_version, applicability_snapshot,
    seo, brief, publishing, created_by, updated_by
  ) VALUES (
    p_knowledge_id,
    COALESCE(nullif(trim(p_title), ''), v_k.title),
    'draft',
    'seo_review',
    v_k.version,
    v_k.applicability,
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
        'linkedin', jsonb_build_object('status', 'not_started'),
        'google_ads', jsonb_build_object('status', 'not_started'),
        'meta_ads', jsonb_build_object('status', 'not_started')
      )
    ),
    auth.uid(),
    auth.uid()
  )
  RETURNING * INTO v_row;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'content_topic',
    v_row.id,
    'admin.content_topic.created',
    jsonb_build_object('knowledge_id', p_knowledge_id, 'allow_duplicate', COALESCE(p_allow_duplicate, false))
  );

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_set_content_topic_workflow_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_content_topic_workflow_status(
  p_topic_id uuid,
  p_workflow_status text,
  p_generation_error text DEFAULT NULL
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

  IF p_workflow_status NOT IN (
    'generating_seo', 'seo_review', 'generating_brief', 'brief_review',
    'ready_for_outputs', 'generating_outputs', 'output_review',
    'visual_concept_review', 'generating_final_assets', 'ready_for_publishing',
    'generation_failed'
  ) THEN
    RAISE EXCEPTION 'invalid_workflow_status';
  END IF;

  UPDATE public.content_topics
  SET
    workflow_status = p_workflow_status,
    seo = CASE
      WHEN p_generation_error IS NOT NULL AND p_workflow_status = 'generation_failed'
        THEN seo || jsonb_build_object('last_error', p_generation_error)
      ELSE seo
    END,
    brief = CASE
      WHEN p_generation_error IS NOT NULL AND p_workflow_status = 'generation_failed'
        THEN brief || jsonb_build_object('last_error', p_generation_error)
      ELSE brief
    END,
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_topic_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'content_topic_not_found';
  END IF;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_upsert_content_topic_stage — preserve approved envelopes on regen
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_upsert_content_topic_stage(
  p_topic_id uuid,
  p_seo jsonb DEFAULT NULL,
  p_brief jsonb DEFAULT NULL,
  p_creative jsonb DEFAULT NULL,
  p_publishing jsonb DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_workflow_status text DEFAULT NULL
) RETURNS public.content_topics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.content_topics;
  v_seo jsonb;
  v_brief jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT * INTO v_row FROM public.content_topics WHERE id = p_topic_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'content_topic_not_found';
  END IF;

  v_seo := COALESCE(p_seo, v_row.seo);
  v_brief := COALESCE(p_brief, v_row.brief);

  -- Never overwrite approved snapshots when saving draft edits to current only.
  IF p_seo IS NOT NULL AND v_row.seo ? 'approved' AND v_row.seo->'approved' IS NOT NULL THEN
    v_seo := v_row.seo || jsonb_build_object(
      'current', COALESCE(p_seo->'current', p_seo),
      'approval_status', COALESCE(p_seo->>'approval_status', v_row.seo->>'approval_status', 'pending')
    );
  END IF;

  IF p_brief IS NOT NULL AND v_row.brief ? 'approved' AND v_row.brief->'approved' IS NOT NULL THEN
    v_brief := v_row.brief || jsonb_build_object(
      'current', COALESCE(p_brief->'current', p_brief),
      'approval_status', COALESCE(p_brief->>'approval_status', v_row.brief->>'approval_status', 'pending')
    );
  END IF;

  UPDATE public.content_topics
  SET
    title = COALESCE(nullif(trim(p_title), ''), title),
    status = COALESCE(p_status, status),
    workflow_status = COALESCE(p_workflow_status, workflow_status),
    seo = v_seo,
    brief = v_brief,
    creative = COALESCE(p_creative, creative),
    publishing = COALESCE(p_publishing, publishing),
    updated_by = auth.uid(),
    updated_at = now(),
    upstream_hash = md5(
      COALESCE(v_seo, seo)::text || COALESCE(v_brief, brief)::text || applicability_snapshot::text
    )
  WHERE id = p_topic_id
  RETURNING * INTO v_row;

  IF p_seo IS NOT NULL OR p_brief IS NOT NULL THEN
    UPDATE public.content_outputs
    SET status = 'needs_update', updated_at = now()
    WHERE topic_id = p_topic_id
      AND status IN ('approved', 'needs_review', 'draft');
  END IF;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- Stage approval / rejection
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_approve_content_topic_seo(
  p_topic_id uuid,
  p_seo jsonb DEFAULT NULL
) RETURNS public.content_topics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.content_topics;
  v_seo jsonb;
  v_current jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT * INTO v_row FROM public.content_topics WHERE id = p_topic_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'content_topic_not_found';
  END IF;

  v_seo := COALESCE(p_seo, v_row.seo);
  v_current := COALESCE(v_seo->'current', '{}'::jsonb);

  IF COALESCE(v_current->>'primary_keyword', '') = '' AND COALESCE(v_current->>'primary_search_theme', '') = '' THEN
    RAISE EXCEPTION 'seo_proposal_empty';
  END IF;

  v_seo := v_seo || jsonb_build_object(
    'approval_status', 'approved',
    'approved', v_current,
    'current', v_current,
    'stale', false,
    'approved_at', now(),
    'approved_by', auth.uid()
  );

  UPDATE public.content_topics
  SET
    seo = v_seo,
    workflow_status = 'brief_review',
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_topic_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_content_topic_seo(
  p_topic_id uuid,
  p_reason text DEFAULT NULL
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
    seo = seo || jsonb_build_object(
      'approval_status', 'rejected',
      'rejection_reason', nullif(trim(COALESCE(p_reason, '')), ''),
      'stale', false
    ),
    workflow_status = 'seo_review',
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_topic_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'content_topic_not_found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_content_topic_brief(
  p_topic_id uuid,
  p_brief jsonb DEFAULT NULL
) RETURNS public.content_topics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.content_topics;
  v_brief jsonb;
  v_current jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT * INTO v_row FROM public.content_topics WHERE id = p_topic_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'content_topic_not_found';
  END IF;

  IF COALESCE(v_row.seo->>'approval_status', 'none') <> 'approved' THEN
    RAISE EXCEPTION 'seo_not_approved';
  END IF;

  v_brief := COALESCE(p_brief, v_row.brief);
  v_current := COALESCE(v_brief->'current', '{}'::jsonb);

  IF COALESCE(v_current->>'working_title', v_current->>'title', '') = '' THEN
    RAISE EXCEPTION 'brief_proposal_empty';
  END IF;

  v_brief := v_brief || jsonb_build_object(
    'approval_status', 'approved',
    'approved', v_current,
    'current', v_current,
    'stale', false,
    'approved_at', now(),
    'approved_by', auth.uid()
  );

  UPDATE public.content_topics
  SET
    brief = v_brief,
    workflow_status = 'ready_for_outputs',
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_topic_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_content_topic_brief(
  p_topic_id uuid,
  p_reason text DEFAULT NULL
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
    brief = brief || jsonb_build_object(
      'approval_status', 'rejected',
      'rejection_reason', nullif(trim(COALESCE(p_reason, '')), ''),
      'stale', false
    ),
    workflow_status = 'brief_review',
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_topic_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'content_topic_not_found';
  END IF;

  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------------------
-- admin_upsert_content_output — create on demand; extended kinds
-- ---------------------------------------------------------------------------
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
  v_topic public.content_topics;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  IF p_output_kind NOT IN (
    'core_article', 'faq', 'in_app_tip', 'newsletter', 'social_post', 'reel_script'
  ) THEN
    RAISE EXCEPTION 'invalid_output_kind';
  END IF;

  SELECT * INTO v_topic FROM public.content_topics WHERE id = p_topic_id;
  IF v_topic.id IS NULL THEN
    RAISE EXCEPTION 'content_topic_not_found';
  END IF;

  IF COALESCE(v_topic.brief->>'approval_status', 'none') <> 'approved' THEN
    RAISE EXCEPTION 'brief_not_approved';
  END IF;

  SELECT * INTO v_existing
  FROM public.content_outputs
  WHERE topic_id = p_topic_id AND output_kind = p_output_kind;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.content_outputs (
      topic_id, output_kind, status, title, body, structured, provenance
    ) VALUES (
      p_topic_id,
      p_output_kind,
      COALESCE(p_status, 'draft'),
      p_title,
      p_body,
      COALESCE(p_structured, '{}'::jsonb),
      COALESCE(p_provenance, '{}'::jsonb)
    )
    RETURNING * INTO v_row;

    RETURN v_row;
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

-- ---------------------------------------------------------------------------
-- Staleness when upstream Knowledge changes
-- ---------------------------------------------------------------------------
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
      seo = seo || jsonb_build_object('stale', true),
      brief = brief || jsonb_build_object('stale', true),
      creative = creative || jsonb_build_object('stale', true),
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

GRANT EXECUTE ON FUNCTION public.admin_create_content_topic(uuid, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_content_topic_workflow_status(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_content_topic_seo(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reject_content_topic_seo(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_content_topic_brief(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reject_content_topic_brief(uuid, text) TO authenticated, service_role;
