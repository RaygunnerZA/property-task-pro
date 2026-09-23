-- Fix admin_set_knowledge_watch_settings: audit_logs.entity_id is uuid,
-- not text — "default" was invalid. Use platform sentinel + metadata.

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
  v_platform uuid := '00000000-0000-0000-0000-000000000000'::uuid;
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
    v_platform,
    v_uid,
    'knowledge_watch_settings',
    v_platform,
    'update',
    jsonb_build_object(
      'settings_id', 'default',
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
