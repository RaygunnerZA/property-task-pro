-- Knowledge Watch settings, monthly usage, and run audit trail.
-- Platform-scoped (like ai_batch_jobs). Discovery ≠ ≠ operational Signals.
-- @Docs/29_Knowledge.md · @Docs/03_Data_Model.md · @Docs/32_Phase3

-- ---------------------------------------------------------------------------
-- Settings (single-row platform config)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_watch_settings (
  id text PRIMARY KEY DEFAULT 'default'
    CHECK (id = 'default'),
  automated_research text NOT NULL DEFAULT 'paused'
    CHECK (automated_research IN ('paused', 'on')),
  research_allowance text NOT NULL DEFAULT 'light'
    CHECK (research_allowance IN ('light', 'standard', 'thorough')),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.knowledge_watch_settings IS
  'Platform Knowledge Watch controls. Conservative defaults: research paused, light allowance. Not org-scoped.';

ALTER TABLE public.knowledge_watch_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_watch_settings_select_admin ON public.knowledge_watch_settings;
CREATE POLICY knowledge_watch_settings_select_admin ON public.knowledge_watch_settings
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON public.knowledge_watch_settings FROM PUBLIC, anon;
REVOKE ALL ON public.knowledge_watch_settings FROM authenticated;
GRANT SELECT ON public.knowledge_watch_settings TO authenticated;
GRANT ALL ON public.knowledge_watch_settings TO service_role;

INSERT INTO public.knowledge_watch_settings (id, automated_research, research_allowance)
VALUES ('default', 'paused', 'light')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Monthly usage (enforced server-side)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_watch_usage (
  period_ym text PRIMARY KEY
    CHECK (period_ym ~ '^[0-9]{4}-[0-9]{2}$'),
  searches_used integer NOT NULL DEFAULT 0 CHECK (searches_used >= 0),
  pages_used integer NOT NULL DEFAULT 0 CHECK (pages_used >= 0),
  tokens_used bigint NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  cost_units_used numeric NOT NULL DEFAULT 0 CHECK (cost_units_used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.knowledge_watch_usage IS
  'Monthly Knowledge Watch research spend. Enforced in knowledge-watch-run; never silently exceed.';

ALTER TABLE public.knowledge_watch_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_watch_usage_select_admin ON public.knowledge_watch_usage;
CREATE POLICY knowledge_watch_usage_select_admin ON public.knowledge_watch_usage
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON public.knowledge_watch_usage FROM PUBLIC, anon;
REVOKE ALL ON public.knowledge_watch_usage FROM authenticated;
GRANT SELECT ON public.knowledge_watch_usage TO authenticated;
GRANT ALL ON public.knowledge_watch_usage TO service_role;

-- ---------------------------------------------------------------------------
-- Run audit trail
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_watch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL CHECK (trigger IN ('scheduled', 'manual')),
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'stopped_at_limit', 'paused', 'failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  summary text,
  sources_checked jsonb NOT NULL DEFAULT '[]'::jsonb,
  subjects_added integer NOT NULL DEFAULT 0 CHECK (subjects_added >= 0),
  subjects_updated integer NOT NULL DEFAULT 0 CHECK (subjects_updated >= 0),
  searches_used integer NOT NULL DEFAULT 0 CHECK (searches_used >= 0),
  pages_used integer NOT NULL DEFAULT 0 CHECK (pages_used >= 0),
  tokens_used bigint NOT NULL DEFAULT 0 CHECK (tokens_used >= 0),
  cost_units_used numeric NOT NULL DEFAULT 0 CHECK (cost_units_used >= 0),
  skip_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text
);

CREATE INDEX IF NOT EXISTS knowledge_watch_runs_started_at_idx
  ON public.knowledge_watch_runs (started_at DESC);

COMMENT ON TABLE public.knowledge_watch_runs IS
  'Audit trail for Knowledge Watch runs. Summary for humans; detail for Advanced diagnostics.';

ALTER TABLE public.knowledge_watch_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_watch_runs_select_admin ON public.knowledge_watch_runs;
CREATE POLICY knowledge_watch_runs_select_admin ON public.knowledge_watch_runs
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON public.knowledge_watch_runs FROM PUBLIC, anon;
REVOKE ALL ON public.knowledge_watch_runs FROM authenticated;
GRANT SELECT ON public.knowledge_watch_runs TO authenticated;
GRANT ALL ON public.knowledge_watch_runs TO service_role;

-- ---------------------------------------------------------------------------
-- Admin RPCs (named access — not direct table writes from client)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_knowledge_watch_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings knowledge_watch_settings%ROWTYPE;
  v_period text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_usage knowledge_watch_usage%ROWTYPE;
  v_run knowledge_watch_runs%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_settings FROM knowledge_watch_settings WHERE id = 'default';
  IF NOT FOUND THEN
    INSERT INTO knowledge_watch_settings (id) VALUES ('default')
    RETURNING * INTO v_settings;
  END IF;

  SELECT * INTO v_usage FROM knowledge_watch_usage WHERE period_ym = v_period;
  IF NOT FOUND THEN
    v_usage.period_ym := v_period;
    v_usage.searches_used := 0;
    v_usage.pages_used := 0;
    v_usage.tokens_used := 0;
    v_usage.cost_units_used := 0;
  END IF;

  SELECT * INTO v_run
  FROM knowledge_watch_runs
  ORDER BY started_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'automated_research', v_settings.automated_research,
    'research_allowance', v_settings.research_allowance,
    'updated_at', v_settings.updated_at,
    'updated_by', v_settings.updated_by,
    'usage', jsonb_build_object(
      'period_ym', v_usage.period_ym,
      'searches_used', v_usage.searches_used,
      'pages_used', v_usage.pages_used,
      'tokens_used', v_usage.tokens_used,
      'cost_units_used', v_usage.cost_units_used
    ),
    'last_run', CASE WHEN v_run.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_run.id,
      'trigger', v_run.trigger,
      'status', v_run.status,
      'started_at', v_run.started_at,
      'finished_at', v_run.finished_at,
      'summary', v_run.summary,
      'searches_used', v_run.searches_used,
      'pages_used', v_run.pages_used,
      'tokens_used', v_run.tokens_used,
      'subjects_added', v_run.subjects_added,
      'subjects_updated', v_run.subjects_updated,
      'skip_reasons', v_run.skip_reasons
    ) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_knowledge_watch_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_knowledge_watch_settings() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_knowledge_watch_settings(
  p_automated_research text DEFAULT NULL,
  p_research_allowance text DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_settings knowledge_watch_settings%ROWTYPE;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin' USING ERRCODE = '42501';
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_automated_research IS NOT NULL AND p_automated_research NOT IN ('paused', 'on') THEN
    RAISE EXCEPTION 'invalid_automated_research';
  END IF;
  IF p_research_allowance IS NOT NULL AND p_research_allowance NOT IN ('light', 'standard', 'thorough') THEN
    RAISE EXCEPTION 'invalid_research_allowance';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  INSERT INTO knowledge_watch_settings (id, automated_research, research_allowance, updated_by, updated_at)
  VALUES (
    'default',
    COALESCE(p_automated_research, 'paused'),
    COALESCE(p_research_allowance, 'light'),
    v_uid,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    automated_research = COALESCE(p_automated_research, knowledge_watch_settings.automated_research),
    research_allowance = COALESCE(p_research_allowance, knowledge_watch_settings.research_allowance),
    updated_by = v_uid,
    updated_at = now()
  RETURNING * INTO v_settings;

  INSERT INTO audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_uid,
    'knowledge_watch_settings',
    'default',
    'update',
    jsonb_build_object(
      'reason', trim(p_reason),
      'automated_research', v_settings.automated_research,
      'research_allowance', v_settings.research_allowance
    )
  );

  RETURN public.admin_get_knowledge_watch_settings();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_knowledge_watch_settings(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_knowledge_watch_settings(text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_list_knowledge_watch_runs(p_limit integer DEFAULT 10)
RETURNS SETOF public.knowledge_watch_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT *
  FROM knowledge_watch_runs
  ORDER BY started_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_knowledge_watch_runs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_knowledge_watch_runs(integer) TO authenticated, service_role;
