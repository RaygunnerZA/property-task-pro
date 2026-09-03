-- Fail closed: SEO approval cannot launder ungrounded AI proposals into the brief stage.

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
  v_has_gaps boolean;
  v_has_warnings boolean;
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

  IF lower(COALESCE(v_current->>'source_content_unavailable', 'false')) IN ('true', 't', '1') THEN
    RAISE EXCEPTION 'seo_source_unavailable';
  END IF;

  v_has_gaps :=
    jsonb_typeof(v_current->'evidence_gaps') = 'array'
    AND jsonb_array_length(v_current->'evidence_gaps') > 0;

  v_has_warnings :=
    jsonb_typeof(v_current->'research_warnings') = 'array'
    AND jsonb_array_length(v_current->'research_warnings') > 0;

  IF v_has_gaps OR v_has_warnings THEN
    RAISE EXCEPTION 'seo_verification_required';
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

GRANT EXECUTE ON FUNCTION public.admin_approve_content_topic_seo(uuid, jsonb) TO authenticated, service_role;
