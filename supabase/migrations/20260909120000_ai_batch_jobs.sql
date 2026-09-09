-- Durable AI batch jobs (Gemini Batch API). Platform-scoped, like ai_route_overrides.
-- Writes via Edge Functions with service role after platform-admin authz.
-- Never auto-verifies or auto-publishes Knowledge.
-- Canonical: @Docs/03_Data_Model.md, @Docs/07_AI_Intelligence.md, @Docs/29_Knowledge.md

CREATE TABLE IF NOT EXISTS public.ai_batch_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability text NOT NULL,
  mode text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  provider text NOT NULL DEFAULT 'GEMINI',
  model_used text,
  prompt_version text,
  provider_batch_id text,
  item_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  item_count integer NOT NULL DEFAULT 0,
  succeeded_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_batch_jobs_capability_check CHECK (capability IN (
    'knowledge_guidance_draft',
    'knowledge_gap_research',
    'content_seo_draft',
    'content_brief_draft',
    'content_output_draft',
    'content_visual_brief'
  )),
  CONSTRAINT ai_batch_jobs_mode_check CHECK (mode IN (
    'generate',
    'improve',
    'research',
    'seo',
    'brief',
    'output',
    'visual_brief'
  )),
  CONSTRAINT ai_batch_jobs_status_check CHECK (status IN (
    'queued',
    'submitted',
    'running',
    'intake_pending',
    'succeeded',
    'failed',
    'cancelled'
  )),
  CONSTRAINT ai_batch_jobs_item_count_check CHECK (
    item_count >= 0 AND item_count <= 80
  ),
  CONSTRAINT ai_batch_jobs_counts_check CHECK (
    succeeded_count >= 0 AND failed_count >= 0
  )
);

CREATE INDEX IF NOT EXISTS ai_batch_jobs_created_at_idx
  ON public.ai_batch_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_batch_jobs_open_idx
  ON public.ai_batch_jobs (created_at DESC)
  WHERE status IN ('queued', 'submitted', 'running', 'intake_pending');

COMMENT ON TABLE public.ai_batch_jobs IS
  'Platform-admin Gemini Batch jobs for Knowledge guidance, gap research, and (later) Content Tree. Service-role writes after in-function platform-admin checks. Poll every ~15m via ai-batch-poll.';

ALTER TABLE public.ai_batch_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_batch_jobs_select_admin ON public.ai_batch_jobs;
CREATE POLICY ai_batch_jobs_select_admin ON public.ai_batch_jobs
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

REVOKE ALL ON public.ai_batch_jobs FROM PUBLIC, anon;
REVOKE ALL ON public.ai_batch_jobs FROM authenticated;
GRANT SELECT ON public.ai_batch_jobs TO authenticated;
GRANT ALL ON public.ai_batch_jobs TO service_role;

-- Named RPC so the UI does not depend on PostgREST table grants (Ch 25).
-- Not audited: the Review/Gaps pages poll this every ~30s while jobs are open.
CREATE OR REPLACE FUNCTION public.admin_list_ai_batch_jobs(p_limit integer DEFAULT 25)
RETURNS TABLE (
  id uuid,
  capability text,
  mode text,
  status text,
  created_by uuid,
  provider text,
  model_used text,
  prompt_version text,
  provider_batch_id text,
  item_ids jsonb,
  item_count integer,
  succeeded_count integer,
  failed_count integer,
  error_message text,
  metadata jsonb,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit integer;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RETURN;
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50);

  RETURN QUERY
  SELECT
    j.id,
    j.capability,
    j.mode,
    j.status,
    j.created_by,
    j.provider,
    j.model_used,
    j.prompt_version,
    j.provider_batch_id,
    j.item_ids,
    j.item_count,
    j.succeeded_count,
    j.failed_count,
    j.error_message,
    j.metadata,
    j.submitted_at,
    j.completed_at,
    j.created_at,
    j.updated_at
  FROM public.ai_batch_jobs j
  ORDER BY j.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_ai_batch_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_ai_batch_jobs(integer) TO authenticated, service_role;

-- Service-role only. Poller applies one unverified draft for a row that belongs
-- to the job. Actor is the admin who queued the job. Never sets verified/published.
CREATE OR REPLACE FUNCTION public.apply_ai_batch_guidance_result(
  p_job_id uuid,
  p_knowledge_id uuid,
  p_summary text,
  p_draft_meta jsonb DEFAULT '{}'::jsonb
) RETURNS public.knowledge
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job public.ai_batch_jobs;
  v_row public.knowledge;
  v_summary text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'not_service_role';
  END IF;

  SELECT * INTO v_job FROM public.ai_batch_jobs WHERE id = p_job_id;
  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'batch_job_not_found';
  END IF;
  IF v_job.capability <> 'knowledge_guidance_draft' THEN
    RAISE EXCEPTION 'batch_job_wrong_capability';
  END IF;
  IF v_job.status NOT IN ('queued', 'submitted', 'running') THEN
    RAISE EXCEPTION 'batch_job_not_open';
  END IF;
  IF NOT (v_job.item_ids @> to_jsonb(p_knowledge_id::text)) THEN
    RAISE EXCEPTION 'knowledge_not_in_job';
  END IF;

  v_summary := nullif(btrim(COALESCE(p_summary, '')), '');
  IF v_summary IS NOT NULL AND public.knowledge_text_is_row_ref(v_summary) THEN
    RAISE EXCEPTION 'guidance_invalid_row_ref';
  END IF;
  IF v_summary IS NULL OR NOT public.knowledge_text_is_meaningful_guidance(v_summary) THEN
    RAISE EXCEPTION 'guidance_required';
  END IF;

  SELECT * INTO v_row FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;
  IF v_row.status <> 'candidate' THEN
    RAISE EXCEPTION 'not_candidate';
  END IF;

  PERFORM public.knowledge_invalidate_critic(p_knowledge_id, 'guidance_edit');

  UPDATE public.knowledge
  SET
    summary = v_summary,
    provenance = provenance || jsonb_build_object(
      'guidance_draft', COALESCE(p_draft_meta, '{}'::jsonb) || jsonb_build_object(
        'unverified', true,
        'proposed_at', COALESCE(p_draft_meta->>'proposed_at', now()::text),
        'source', COALESCE(p_draft_meta->>'source', 'ai'),
        'delivery', 'batch'
      )
    ),
    updated_at = now()
  WHERE id = p_knowledge_id
  RETURNING * INTO v_row;

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (
    v_row.id,
    v_row.org_id,
    'human_edit',
    v_job.created_by,
    jsonb_build_object(
      'field', 'draft_guidance',
      'via', 'apply_ai_batch_guidance_result',
      'batch_job_id', p_job_id,
      'draft_meta', COALESCE(p_draft_meta, '{}'::jsonb),
      'critic_invalidated', true
    )
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_ai_batch_guidance_result(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_ai_batch_guidance_result(uuid, uuid, text, jsonb) TO service_role;
