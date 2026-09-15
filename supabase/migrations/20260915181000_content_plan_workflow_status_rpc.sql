-- Allow Phase 2 workflow statuses in admin_set_content_topic_workflow_status.

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
    'generating_seo', 'seo_review',
    'generating_plan', 'plan_review',
    'generating_brief', 'brief_review',
    'ready_for_outputs',
    'generating_content', 'generating_outputs',
    'content_review', 'output_review',
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

GRANT EXECUTE ON FUNCTION public.admin_set_content_topic_workflow_status(uuid, text, text) TO authenticated, service_role;
