-- Knowledge capability: tables, RLS, org + admin RPCs.
-- Canonical: @Docs/03_Data_Model.md

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('platform', 'organisation')),
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'verified', 'published', 'stale', 'archived')),
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('filla_curated', 'org_upload', 'operational_discovery', 'community_brain')),
  trust_score NUMERIC,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  cohort_size INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_id UUID REFERENCES public.knowledge(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_scope_org_ck CHECK (
    (scope = 'platform' AND org_id IS NULL)
    OR (scope = 'organisation' AND org_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS knowledge_org_status_idx ON public.knowledge (org_id, status);
CREATE INDEX IF NOT EXISTS knowledge_platform_published_idx
  ON public.knowledge (status)
  WHERE scope = 'platform' AND status = 'published';
CREATE INDEX IF NOT EXISTS knowledge_source_kind_idx ON public.knowledge (source_kind);

CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES public.knowledge(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'attachment', 'url', 'compliance_document', 'intake_item',
    'brain_pattern', 'message', 'manual', 'other'
  )),
  label TEXT,
  url TEXT,
  attachment_id UUID,
  external_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_sources_knowledge_id_idx
  ON public.knowledge_sources (knowledge_id);

CREATE TABLE IF NOT EXISTS public.knowledge_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  knowledge_id UUID NOT NULL REFERENCES public.knowledge(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'property', 'space', 'asset', 'compliance', 'task', 'report', 'document'
  )),
  entity_id UUID NOT NULL,
  relationship TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (org_id, knowledge_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS knowledge_links_entity_idx
  ON public.knowledge_links (org_id, entity_type, entity_id);

CREATE TABLE IF NOT EXISTS public.knowledge_verification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES public.knowledge(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'extractor', 'critic', 'human_approve', 'human_reject',
    'human_edit', 'publish', 'stale', 'archive', 'candidate_created'
  )),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_verification_events_knowledge_idx
  ON public.knowledge_verification_events (knowledge_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_org_owner_or_manager(p_org_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND lower(om.role) IN ('owner', 'manager', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organisation_members om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_knowledge_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_touch_updated_at ON public.knowledge;
CREATE TRIGGER knowledge_touch_updated_at
  BEFORE UPDATE ON public.knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_knowledge_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_verification_events ENABLE ROW LEVEL SECURITY;

-- knowledge SELECT: org members see org rows; any member sees published platform
CREATE POLICY knowledge_select_org ON public.knowledge
  FOR SELECT TO authenticated
  USING (
    (scope = 'organisation' AND org_id IS NOT NULL AND public.is_org_member(org_id))
    OR (scope = 'platform' AND status = 'published')
  );

CREATE POLICY knowledge_insert_org ON public.knowledge
  FOR INSERT TO authenticated
  WITH CHECK (
    scope = 'organisation'
    AND org_id IS NOT NULL
    AND public.is_org_owner_or_manager(org_id)
  );

CREATE POLICY knowledge_update_org ON public.knowledge
  FOR UPDATE TO authenticated
  USING (
    scope = 'organisation'
    AND org_id IS NOT NULL
    AND public.is_org_owner_or_manager(org_id)
  )
  WITH CHECK (
    scope = 'organisation'
    AND org_id IS NOT NULL
    AND public.is_org_owner_or_manager(org_id)
  );

-- knowledge_sources: visible if parent knowledge is selectable
CREATE POLICY knowledge_sources_select ON public.knowledge_sources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge k
      WHERE k.id = knowledge_id
        AND (
          (k.scope = 'organisation' AND k.org_id IS NOT NULL AND public.is_org_member(k.org_id))
          OR (k.scope = 'platform' AND k.status = 'published')
        )
    )
  );

CREATE POLICY knowledge_sources_write_org ON public.knowledge_sources
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge k
      WHERE k.id = knowledge_id
        AND k.scope = 'organisation'
        AND k.org_id IS NOT NULL
        AND public.is_org_owner_or_manager(k.org_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.knowledge k
      WHERE k.id = knowledge_id
        AND k.scope = 'organisation'
        AND k.org_id IS NOT NULL
        AND public.is_org_owner_or_manager(k.org_id)
    )
  );

CREATE POLICY knowledge_links_select ON public.knowledge_links
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

CREATE POLICY knowledge_links_write ON public.knowledge_links
  FOR ALL TO authenticated
  USING (public.is_org_owner_or_manager(org_id))
  WITH CHECK (public.is_org_owner_or_manager(org_id));

CREATE POLICY knowledge_verification_events_select ON public.knowledge_verification_events
  FOR SELECT TO authenticated
  USING (
    (org_id IS NOT NULL AND public.is_org_member(org_id))
    OR EXISTS (
      SELECT 1 FROM public.knowledge k
      WHERE k.id = knowledge_id
        AND k.scope = 'platform'
        AND k.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------
-- Org RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_published_knowledge(p_org_id UUID, p_query TEXT DEFAULT NULL)
RETURNS SETOF public.knowledge
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_member(p_org_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT k.*
  FROM public.knowledge k
  WHERE k.status = 'published'
    AND (
      k.scope = 'platform'
      OR (k.scope = 'organisation' AND k.org_id = p_org_id)
    )
    AND (
      p_query IS NULL
      OR trim(p_query) = ''
      OR k.title ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(k.summary, '') ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(k.body, '') ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY k.published_at DESC NULLS LAST, k.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_org_knowledge_review_queue(p_org_id UUID)
RETURNS SETOF public.knowledge
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_owner_or_manager(p_org_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT k.*
  FROM public.knowledge k
  WHERE k.scope = 'organisation'
    AND k.org_id = p_org_id
    AND k.status IN ('candidate', 'verified', 'stale')
  ORDER BY k.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_org_knowledge(
  p_org_id UUID,
  p_title TEXT,
  p_summary TEXT DEFAULT NULL,
  p_body TEXT DEFAULT NULL,
  p_source_kind TEXT DEFAULT 'org_upload',
  p_content JSONB DEFAULT '{}'::jsonb,
  p_provenance JSONB DEFAULT '{}'::jsonb,
  p_id UUID DEFAULT NULL
)
RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.knowledge;
BEGIN
  IF NOT public.is_org_owner_or_manager(p_org_id) THEN
    RAISE EXCEPTION 'not_org_manager';
  END IF;

  IF p_source_kind NOT IN ('org_upload', 'operational_discovery', 'filla_curated') THEN
    RAISE EXCEPTION 'invalid_source_kind_for_org';
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.knowledge
    SET
      title = p_title,
      summary = p_summary,
      body = p_body,
      content = COALESCE(p_content, '{}'::jsonb),
      provenance = COALESCE(p_provenance, provenance),
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
    scope, status, org_id, title, summary, body, content, source_kind, provenance, created_by
  ) VALUES (
    'organisation', 'candidate', p_org_id, p_title, p_summary, p_body,
    COALESCE(p_content, '{}'::jsonb), p_source_kind, COALESCE(p_provenance, '{}'::jsonb), auth.uid()
  )
  RETURNING * INTO v_row;

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (v_row.id, p_org_id, 'candidate_created', auth.uid(), jsonb_build_object('source_kind', p_source_kind));

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_knowledge_status(
  p_knowledge_id UUID,
  p_status TEXT,
  p_org_id UUID DEFAULT NULL
)
RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.knowledge;
  v_min INT := public.brain_min_cohort();
BEGIN
  IF p_status NOT IN ('candidate', 'verified', 'published', 'stale', 'archived') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  SELECT * INTO v_row FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  IF v_row.scope = 'organisation' THEN
    IF p_org_id IS NULL OR v_row.org_id <> p_org_id THEN
      RAISE EXCEPTION 'org_mismatch';
    END IF;
    IF NOT public.is_org_owner_or_manager(v_row.org_id) THEN
      RAISE EXCEPTION 'not_org_manager';
    END IF;
  ELSIF v_row.scope = 'platform' THEN
    IF NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'not_platform_admin';
    END IF;
  END IF;

  IF p_status = 'published' THEN
    IF v_row.source_kind = 'community_brain'
       AND (v_row.cohort_size IS NULL OR v_row.cohort_size < v_min) THEN
      RAISE EXCEPTION 'cohort_below_minimum' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE public.knowledge
  SET
    status = p_status,
    reviewed_by = auth.uid(),
    published_at = CASE WHEN p_status = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
    updated_at = now()
  WHERE id = p_knowledge_id
  RETURNING * INTO v_row;

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (
    v_row.id,
    v_row.org_id,
    CASE
      WHEN p_status = 'published' THEN 'publish'
      WHEN p_status = 'archived' THEN 'archive'
      WHEN p_status = 'stale' THEN 'stale'
      WHEN p_status = 'verified' THEN 'human_approve'
      ELSE 'human_edit'
    END,
    auth.uid(),
    jsonb_build_object('status', p_status)
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.link_knowledge_entity(
  p_org_id UUID,
  p_knowledge_id UUID,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_relationship TEXT DEFAULT NULL
)
RETURNS public.knowledge_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.knowledge_links;
  v_k public.knowledge;
BEGIN
  IF NOT public.is_org_owner_or_manager(p_org_id) THEN
    RAISE EXCEPTION 'not_org_manager';
  END IF;

  SELECT * INTO v_k FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_k.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;
  IF v_k.scope = 'organisation' AND v_k.org_id <> p_org_id THEN
    RAISE EXCEPTION 'org_mismatch';
  END IF;
  IF v_k.status <> 'published' AND v_k.scope = 'organisation' AND v_k.status NOT IN ('verified', 'candidate') THEN
    RAISE EXCEPTION 'invalid_link_status';
  END IF;

  INSERT INTO public.knowledge_links (org_id, knowledge_id, entity_type, entity_id, relationship, created_by)
  VALUES (p_org_id, p_knowledge_id, p_entity_type, p_entity_id, p_relationship, auth.uid())
  ON CONFLICT (org_id, knowledge_id, entity_type, entity_id)
  DO UPDATE SET relationship = EXCLUDED.relationship
  RETURNING * INTO v_link;

  RETURN v_link;
END;
$$;

-- Service-role helper for edge candidate inserts (bypasses client RLS via SECURITY DEFINER + service role call)
CREATE OR REPLACE FUNCTION public.create_knowledge_candidate(
  p_scope TEXT,
  p_org_id UUID,
  p_title TEXT,
  p_summary TEXT,
  p_body TEXT,
  p_source_kind TEXT,
  p_content JSONB DEFAULT '{}'::jsonb,
  p_provenance JSONB DEFAULT '{}'::jsonb,
  p_cohort_size INTEGER DEFAULT NULL,
  p_trust_score NUMERIC DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    provenance, cohort_size, trust_score, created_by
  ) VALUES (
    p_scope, 'candidate', p_org_id, p_title, p_summary, p_body,
    COALESCE(p_content, '{}'::jsonb), p_source_kind,
    COALESCE(p_provenance, '{}'::jsonb), p_cohort_size, p_trust_score, p_created_by
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
-- Admin RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_knowledge_review_queue(
  p_statuses TEXT[] DEFAULT ARRAY['candidate', 'verified']::TEXT[],
  p_scope TEXT DEFAULT NULL
)
RETURNS SETOF public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'platform',
    auth.uid(),
    'admin.knowledge.queue_listed',
    jsonb_build_object('statuses', to_jsonb(p_statuses), 'scope', p_scope)
  );

  RETURN QUERY
  SELECT k.*
  FROM public.knowledge k
  WHERE k.status = ANY (p_statuses)
    AND (p_scope IS NULL OR k.scope = p_scope)
  ORDER BY
    CASE k.scope WHEN 'platform' THEN 0 ELSE 1 END,
    k.updated_at DESC
  LIMIT 200;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_knowledge(p_knowledge_id UUID)
RETURNS SETOF public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'knowledge',
    p_knowledge_id,
    'admin.knowledge.viewed',
    '{}'::jsonb
  );

  RETURN QUERY
  SELECT k.* FROM public.knowledge k WHERE k.id = p_knowledge_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_knowledge_status(
  p_knowledge_id UUID,
  p_status TEXT
)
RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF p_status = 'published'
     AND v_row.source_kind = 'community_brain'
     AND (v_row.cohort_size IS NULL OR v_row.cohort_size < v_min) THEN
    RAISE EXCEPTION 'cohort_below_minimum';
  END IF;

  UPDATE public.knowledge
  SET
    status = p_status,
    reviewed_by = auth.uid(),
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

CREATE OR REPLACE FUNCTION public.admin_upsert_platform_knowledge(
  p_title TEXT,
  p_summary TEXT DEFAULT NULL,
  p_body TEXT DEFAULT NULL,
  p_source_kind TEXT DEFAULT 'filla_curated',
  p_content JSONB DEFAULT '{}'::jsonb,
  p_provenance JSONB DEFAULT '{}'::jsonb,
  p_cohort_size INTEGER DEFAULT NULL,
  p_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT 'candidate'
)
RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.knowledge;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  IF p_source_kind NOT IN ('filla_curated', 'community_brain') THEN
    RAISE EXCEPTION 'invalid_platform_source_kind';
  END IF;

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
      updated_at = now()
    WHERE id = p_id AND scope = 'platform'
    RETURNING * INTO v_row;

    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'knowledge_not_found';
    END IF;
  ELSE
    INSERT INTO public.knowledge (
      scope, status, org_id, title, summary, body, content, source_kind,
      provenance, cohort_size, created_by
    ) VALUES (
      'platform', COALESCE(p_status, 'candidate'), NULL, p_title, p_summary, p_body,
      COALESCE(p_content, '{}'::jsonb), p_source_kind,
      COALESCE(p_provenance, '{}'::jsonb), p_cohort_size, auth.uid()
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

CREATE OR REPLACE FUNCTION public.apply_knowledge_critic_result(
  p_knowledge_id UUID,
  p_trust_score NUMERIC,
  p_critic_notes TEXT DEFAULT NULL,
  p_critic_model TEXT DEFAULT NULL,
  p_critic_provider TEXT DEFAULT NULL,
  p_mark_verified BOOLEAN DEFAULT false
)
RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.knowledge;
BEGIN
  UPDATE public.knowledge
  SET
    trust_score = p_trust_score,
    provenance = provenance || jsonb_build_object(
      'critic_model', p_critic_model,
      'critic_provider', p_critic_provider,
      'critic_notes', p_critic_notes,
      'critic_at', now()
    ),
    status = CASE
      WHEN p_mark_verified AND status = 'candidate' THEN 'verified'
      ELSE status
    END,
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
      'mark_verified', p_mark_verified
    )
  );

  RETURN v_row;
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.knowledge TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_links TO authenticated;
GRANT SELECT ON public.knowledge_verification_events TO authenticated;
GRANT ALL ON public.knowledge TO service_role;
GRANT ALL ON public.knowledge_sources TO service_role;
GRANT ALL ON public.knowledge_links TO service_role;
GRANT ALL ON public.knowledge_verification_events TO service_role;

GRANT EXECUTE ON FUNCTION public.is_org_owner_or_manager(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_published_knowledge(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_org_knowledge_review_queue(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_org_knowledge(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_knowledge_status(UUID, TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_knowledge_entity(UUID, UUID, TEXT, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_knowledge_candidate(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, INTEGER, NUMERIC, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_knowledge_review_queue(TEXT[], TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_knowledge(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_knowledge_status(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_platform_knowledge(TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, INTEGER, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_knowledge_critic_result(UUID, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
