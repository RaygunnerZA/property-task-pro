-- Knowledge metrics: usage events + admin snapshot.
-- Canonical definitions: @Docs/03_Data_Model.md, @Docs/29_Knowledge.md

CREATE TABLE IF NOT EXISTS public.knowledge_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  knowledge_id UUID REFERENCES public.knowledge(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'reused',
    'question_answered',
    'automation_created',
    'time_saved'
  )),
  estimated_minutes NUMERIC NOT NULL DEFAULT 0,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_usage_events_org_created_idx
  ON public.knowledge_usage_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_usage_events_type_idx
  ON public.knowledge_usage_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_usage_events_knowledge_idx
  ON public.knowledge_usage_events (knowledge_id)
  WHERE knowledge_id IS NOT NULL;

ALTER TABLE public.knowledge_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_usage_events_select_org ON public.knowledge_usage_events
  FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_member(org_id));

GRANT SELECT ON public.knowledge_usage_events TO authenticated;
GRANT ALL ON public.knowledge_usage_events TO service_role;

-- Default minutes for value metrics (code may override via p_estimated_minutes)
CREATE OR REPLACE FUNCTION public.knowledge_metric_default_minutes(p_event_type TEXT)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_event_type
    WHEN 'question_answered' THEN 5::NUMERIC
    WHEN 'reused' THEN 2::NUMERIC
    WHEN 'automation_created' THEN 10::NUMERIC
    WHEN 'time_saved' THEN 0::NUMERIC
    ELSE 0::NUMERIC
  END;
$$;

CREATE OR REPLACE FUNCTION public.record_knowledge_usage(
  p_event_type TEXT,
  p_org_id UUID DEFAULT NULL,
  p_knowledge_id UUID DEFAULT NULL,
  p_estimated_minutes NUMERIC DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_minutes NUMERIC;
BEGIN
  IF p_event_type NOT IN ('reused', 'question_answered', 'automation_created', 'time_saved') THEN
    RAISE EXCEPTION 'invalid_usage_event_type';
  END IF;

  v_minutes := COALESCE(p_estimated_minutes, public.knowledge_metric_default_minutes(p_event_type));

  INSERT INTO public.knowledge_usage_events (
    org_id, knowledge_id, event_type, estimated_minutes, actor_id, metadata
  ) VALUES (
    p_org_id, p_knowledge_id, p_event_type, v_minutes, p_actor_id, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  -- Parallel time_saved rollup only when minutes > 0 (callers may pass 0 to count without double-counting value)
  IF p_event_type IN ('reused', 'question_answered', 'automation_created') AND v_minutes > 0 THEN
    INSERT INTO public.knowledge_usage_events (
      org_id, knowledge_id, event_type, estimated_minutes, actor_id, metadata
    ) VALUES (
      p_org_id, p_knowledge_id, 'time_saved', v_minutes, p_actor_id,
      COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('from_event', p_event_type)
    );
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.knowledge_metric_default_minutes(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_knowledge_usage(TEXT, UUID, UUID, NUMERIC, UUID, JSONB) TO authenticated, service_role;

-- Platform admin snapshot: Knowledge + value metrics
CREATE OR REPLACE FUNCTION public.admin_knowledge_metrics_snapshot()
RETURNS TABLE (
  org_id UUID,
  org_name TEXT,
  knowledge_created BIGINT,
  knowledge_verified BIGINT,
  knowledge_published BIGINT,
  knowledge_reused BIGINT,
  questions_answered BIGINT,
  automation_created BIGINT,
  time_saved_minutes NUMERIC
)
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
    'admin.knowledge.metrics_viewed',
    jsonb_build_object('timestamp', now())
  );

  RETURN QUERY
  WITH org_base AS (
    SELECT o.id, o.name
    FROM organisations o
    WHERE o.id <> '00000000-0000-0000-0000-000000000000'::uuid
  ),
  created AS (
    SELECT k.org_id, COUNT(*)::BIGINT AS n
    FROM knowledge k
    WHERE k.scope = 'organisation' AND k.org_id IS NOT NULL
    GROUP BY k.org_id
  ),
  verified AS (
    SELECT k.org_id, COUNT(*)::BIGINT AS n
    FROM knowledge k
    WHERE k.scope = 'organisation'
      AND k.org_id IS NOT NULL
      AND k.status IN ('verified', 'published')
    GROUP BY k.org_id
  ),
  published AS (
    SELECT k.org_id, COUNT(*)::BIGINT AS n
    FROM knowledge k
    WHERE k.scope = 'organisation'
      AND k.org_id IS NOT NULL
      AND k.status = 'published'
    GROUP BY k.org_id
  ),
  usage AS (
    SELECT
      u.org_id,
      COUNT(*) FILTER (WHERE u.event_type = 'reused')::BIGINT AS reused,
      COUNT(*) FILTER (WHERE u.event_type = 'question_answered')::BIGINT AS answered,
      COUNT(*) FILTER (WHERE u.event_type = 'automation_created')::BIGINT AS automation,
      COALESCE(SUM(u.estimated_minutes) FILTER (WHERE u.event_type = 'time_saved'), 0)::NUMERIC AS minutes
    FROM knowledge_usage_events u
    WHERE u.org_id IS NOT NULL
    GROUP BY u.org_id
  )
  SELECT
    ob.id AS org_id,
    ob.name AS org_name,
    COALESCE(c.n, 0) AS knowledge_created,
    COALESCE(v.n, 0) AS knowledge_verified,
    COALESCE(p.n, 0) AS knowledge_published,
    COALESCE(us.reused, 0) AS knowledge_reused,
    COALESCE(us.answered, 0) AS questions_answered,
    COALESCE(us.automation, 0) AS automation_created,
    COALESCE(us.minutes, 0) AS time_saved_minutes
  FROM org_base ob
  LEFT JOIN created c ON c.org_id = ob.id
  LEFT JOIN verified v ON v.org_id = ob.id
  LEFT JOIN published p ON p.org_id = ob.id
  LEFT JOIN usage us ON us.org_id = ob.id
  WHERE COALESCE(c.n, 0) > 0
     OR COALESCE(v.n, 0) > 0
     OR COALESCE(us.reused, 0) > 0
     OR COALESCE(us.answered, 0) > 0
     OR COALESCE(us.automation, 0) > 0
  ORDER BY COALESCE(us.minutes, 0) DESC, COALESCE(c.n, 0) DESC, ob.name;

  -- Platform-scope summary as a synthetic row (org_id = sentinel)
  RETURN QUERY
  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS org_id,
    '_platform'::TEXT AS org_name,
    (SELECT COUNT(*)::BIGINT FROM knowledge k WHERE k.scope = 'platform') AS knowledge_created,
    (SELECT COUNT(*)::BIGINT FROM knowledge k WHERE k.scope = 'platform' AND k.status IN ('verified', 'published')) AS knowledge_verified,
    (SELECT COUNT(*)::BIGINT FROM knowledge k WHERE k.scope = 'platform' AND k.status = 'published') AS knowledge_published,
    (SELECT COUNT(*)::BIGINT FROM knowledge_usage_events u WHERE u.org_id IS NULL AND u.event_type = 'reused') AS knowledge_reused,
    (SELECT COUNT(*)::BIGINT FROM knowledge_usage_events u WHERE u.org_id IS NULL AND u.event_type = 'question_answered') AS questions_answered,
    (SELECT COUNT(*)::BIGINT FROM knowledge_usage_events u WHERE u.org_id IS NULL AND u.event_type = 'automation_created') AS automation_created,
    (SELECT COALESCE(SUM(u.estimated_minutes), 0)::NUMERIC FROM knowledge_usage_events u WHERE u.org_id IS NULL AND u.event_type = 'time_saved') AS time_saved_minutes;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_knowledge_metrics_snapshot() TO authenticated, service_role;

-- Org-facing read of own Knowledge metrics (Owner/Manager)
CREATE OR REPLACE FUNCTION public.org_knowledge_metrics(p_org_id UUID)
RETURNS TABLE (
  knowledge_created BIGINT,
  knowledge_verified BIGINT,
  knowledge_published BIGINT,
  knowledge_reused BIGINT,
  questions_answered BIGINT,
  automation_created BIGINT,
  time_saved_minutes NUMERIC
)
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
  SELECT
    (SELECT COUNT(*)::BIGINT FROM knowledge k WHERE k.org_id = p_org_id) AS knowledge_created,
    (SELECT COUNT(*)::BIGINT FROM knowledge k WHERE k.org_id = p_org_id AND k.status IN ('verified', 'published')) AS knowledge_verified,
    (SELECT COUNT(*)::BIGINT FROM knowledge k WHERE k.org_id = p_org_id AND k.status = 'published') AS knowledge_published,
    (SELECT COUNT(*)::BIGINT FROM knowledge_usage_events u WHERE u.org_id = p_org_id AND u.event_type = 'reused') AS knowledge_reused,
    (SELECT COUNT(*)::BIGINT FROM knowledge_usage_events u WHERE u.org_id = p_org_id AND u.event_type = 'question_answered') AS questions_answered,
    (SELECT COUNT(*)::BIGINT FROM knowledge_usage_events u WHERE u.org_id = p_org_id AND u.event_type = 'automation_created') AS automation_created,
    (SELECT COALESCE(SUM(u.estimated_minutes), 0)::NUMERIC FROM knowledge_usage_events u WHERE u.org_id = p_org_id AND u.event_type = 'time_saved') AS time_saved_minutes;
END;
$$;

GRANT EXECUTE ON FUNCTION public.org_knowledge_metrics(UUID) TO authenticated, service_role;
