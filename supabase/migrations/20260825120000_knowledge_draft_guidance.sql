-- Draft guidance backfill (deterministic) + admin apply draft guidance RPC.
-- Does not verify or publish. Clears critic pass when guidance is rewritten.

-- Promote attributes.action / task into summary for candidates missing guidance.
UPDATE public.knowledge k
SET
  summary = COALESCE(
    NULLIF(btrim(k.attributes->>'action'), ''),
    NULLIF(btrim(k.attributes->>'task'), ''),
    NULLIF(btrim(k.attributes->>'guidance'), ''),
    NULLIF(btrim(k.attributes->>'notes'), '')
  ),
  provenance = k.provenance || jsonb_build_object(
    'guidance_draft', jsonb_build_object(
      'source', CASE
        WHEN NULLIF(btrim(k.attributes->>'action'), '') IS NOT NULL THEN 'imported_action'
        WHEN NULLIF(btrim(k.attributes->>'task'), '') IS NOT NULL THEN 'imported_task'
        WHEN NULLIF(btrim(k.attributes->>'guidance'), '') IS NOT NULL THEN 'imported_guidance'
        ELSE 'imported_notes'
      END,
      'proposed_at', now(),
      'supported_by', ARRAY[
        CASE
          WHEN NULLIF(btrim(k.attributes->>'action'), '') IS NOT NULL THEN 'attributes.action'
          WHEN NULLIF(btrim(k.attributes->>'task'), '') IS NOT NULL THEN 'attributes.task'
          WHEN NULLIF(btrim(k.attributes->>'guidance'), '') IS NOT NULL THEN 'attributes.guidance'
          ELSE 'attributes.notes'
        END
      ],
      'unverified', true
    )
  ),
  updated_at = now()
WHERE k.status = 'candidate'
  AND NOT public.knowledge_text_is_meaningful_guidance(k.summary)
  AND NOT public.knowledge_text_is_meaningful_guidance(k.body)
  AND (
    public.knowledge_text_is_meaningful_guidance(k.attributes->>'action')
    OR public.knowledge_text_is_meaningful_guidance(k.attributes->>'task')
    OR public.knowledge_text_is_meaningful_guidance(k.attributes->>'guidance')
    OR public.knowledge_text_is_meaningful_guidance(k.attributes->>'notes')
  )
  AND NOT public.knowledge_text_is_row_ref(COALESCE(k.attributes->>'action', k.attributes->>'task', ''));

CREATE OR REPLACE FUNCTION public.admin_set_knowledge_draft_guidance(
  p_knowledge_id uuid,
  p_summary text,
  p_body text DEFAULT NULL,
  p_draft_meta jsonb DEFAULT '{}'::jsonb
) RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge;
  v_summary text;
  v_body text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  v_summary := nullif(btrim(COALESCE(p_summary, '')), '');
  v_body := nullif(btrim(COALESCE(p_body, '')), '');

  IF v_summary IS NOT NULL AND public.knowledge_text_is_row_ref(v_summary) THEN
    RAISE EXCEPTION 'guidance_invalid_row_ref';
  END IF;
  IF v_body IS NOT NULL AND public.knowledge_text_is_row_ref(v_body) THEN
    RAISE EXCEPTION 'guidance_invalid_row_ref';
  END IF;
  IF v_summary IS NULL OR NOT public.knowledge_text_is_meaningful_guidance(v_summary) THEN
    RAISE EXCEPTION 'guidance_required';
  END IF;

  SELECT * INTO v_row FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;
  IF v_row.status NOT IN ('candidate', 'verified', 'stale') THEN
    RAISE EXCEPTION 'guidance_edit_not_allowed';
  END IF;

  UPDATE public.knowledge
  SET
    summary = v_summary,
    body = COALESCE(v_body, body),
    -- Draft guidance must be re-checked; never leave a stale critic pass.
    provenance = (provenance - 'critic_passed' - 'critic_status' - 'critic_result')
      || jsonb_build_object(
        'guidance_draft', COALESCE(p_draft_meta, '{}'::jsonb) || jsonb_build_object(
          'unverified', true,
          'proposed_at', COALESCE(p_draft_meta->>'proposed_at', now()::text)
        ),
        'critic_passed', false,
        'critic_status', 'stale_after_guidance_edit'
      ),
    status = CASE WHEN status = 'verified' THEN 'candidate' ELSE status END,
    reviewed_by = CASE WHEN status = 'verified' THEN NULL ELSE reviewed_by END,
    updated_at = now()
  WHERE id = p_knowledge_id
  RETURNING * INTO v_row;

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (
    v_row.id,
    v_row.org_id,
    'human_edit',
    auth.uid(),
    jsonb_build_object(
      'field', 'draft_guidance',
      'via', 'admin_set_knowledge_draft_guidance',
      'draft_meta', COALESCE(p_draft_meta, '{}'::jsonb)
    )
  );

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_knowledge_draft_guidance(uuid, text, text, jsonb)
  TO authenticated, service_role;

-- Count candidates that still lack meaningful guidance (for batch UI).
CREATE OR REPLACE FUNCTION public.admin_count_knowledge_missing_guidance()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;
  SELECT count(*)::integer INTO v_count
  FROM public.knowledge k
  WHERE k.status = 'candidate'
    AND k.scope = 'platform'
    AND NOT public.knowledge_text_is_meaningful_guidance(k.summary)
    AND NOT public.knowledge_text_is_meaningful_guidance(k.body)
    AND NOT public.knowledge_text_is_meaningful_guidance(k.attributes->>'action')
    AND NOT public.knowledge_text_is_meaningful_guidance(k.attributes->>'task');
  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_count_knowledge_missing_guidance()
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
