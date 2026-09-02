-- Enforce Knowledge lifecycle: cannot publish a candidate without verifying first.
-- Safe sequence: candidate → verified → published.

CREATE OR REPLACE FUNCTION public.admin_set_knowledge_status(p_knowledge_id uuid, p_status text)
RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Publish only from verified (or already published / stale republish path).
  IF p_status = 'published' AND v_row.status = 'candidate' THEN
    RAISE EXCEPTION 'verify_before_publish';
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
