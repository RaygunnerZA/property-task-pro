-- Fix placeholder jurisdictions; backfill trigger_type from imported fields;
-- recount missing canonical guidance for the Review workbench.

-- 1) Strip unsafe "All"/"Any" jurisdiction placeholders (country-specific rules).
UPDATE public.knowledge k
SET
  applicability = jsonb_set(
    COALESCE(k.applicability, '{}'::jsonb),
    '{jurisdictions}',
    COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(j.elem))
        FROM jsonb_array_elements_text(COALESCE(k.applicability->'jurisdictions', '[]'::jsonb)) AS j(elem)
        WHERE btrim(j.elem) !~* '^(all|any|global|worldwide|n/?a|unknown)$'
      ),
      '[]'::jsonb
    )
  ),
  updated_at = now()
WHERE k.applicability->'jurisdictions' IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(k.applicability->'jurisdictions') AS j(elem)
    WHERE btrim(j.elem) ~* '^(all|any|global|worldwide|n/?a|unknown)$'
  );

-- 2) Deterministic trigger_type from frequency / timing / applies_when / event_trigger.
UPDATE public.knowledge k
SET
  attributes = k.attributes || jsonb_build_object(
    'trigger_type',
    CASE
      WHEN COALESCE(k.attributes->>'trigger_type', k.attributes->>'event_trigger', '') ~* 'event'
        THEN 'event_driven'
      WHEN COALESCE(k.attributes->>'trigger_type', '') ~* 'schedule|recurring'
        THEN 'scheduled'
      WHEN COALESCE(k.attributes->>'trigger_type', '') ~* 'continuous|ongoing'
        THEN 'continuous'
      WHEN COALESCE(k.attributes->>'trigger_type', '') ~* 'threshold'
        THEN 'threshold_based'
      WHEN COALESCE(k.attributes->>'applies_when', k.attributes->>'timing', k.attributes->>'frequency', '')
           ~* 'before|prior|pre-work|consent|notice|when (planning|starting)'
        THEN 'event_driven'
      WHEN COALESCE(k.attributes->>'applies_when', k.attributes->>'timing', k.attributes->>'frequency', '')
           ~* 'threshold|exceed|above|below|limit|CO2|tonne'
        THEN 'threshold_based'
      WHEN COALESCE(k.attributes->>'applies_when', k.attributes->>'timing', k.attributes->>'frequency', '')
           ~* 'annual|yearly|monthly|quarter|every[[:space:]]+[0-9]|recurring|schedule|interval'
        THEN 'scheduled'
      WHEN COALESCE(k.attributes->>'applies_when', k.attributes->>'timing', k.attributes->>'frequency', '')
           ~* 'ongoing|continuous|always|at all times|maintain|replace by'
        THEN 'continuous'
      WHEN NULLIF(btrim(COALESCE(k.attributes->>'frequency', '')), '') IS NOT NULL
        THEN 'scheduled'
      ELSE NULL
    END
  ),
  updated_at = now()
WHERE COALESCE(k.attributes->>'trigger_type', '') = ''
  AND (
    NULLIF(btrim(COALESCE(k.attributes->>'applies_when', '')), '') IS NOT NULL
    OR NULLIF(btrim(COALESCE(k.attributes->>'frequency', '')), '') IS NOT NULL
    OR NULLIF(btrim(COALESCE(k.attributes->>'timing', '')), '') IS NOT NULL
    OR NULLIF(btrim(COALESCE(k.attributes->>'event_trigger', '')), '') IS NOT NULL
  );

-- Remove null trigger_type keys written above
UPDATE public.knowledge
SET attributes = attributes - 'trigger_type'
WHERE attributes ? 'trigger_type' AND attributes->>'trigger_type' IS NULL;

-- 3) Missing guidance count: canonical summary/body empty, but proposable.
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
    AND (
      public.knowledge_text_is_meaningful_guidance(k.attributes->>'action')
      OR public.knowledge_text_is_meaningful_guidance(k.attributes->>'task')
      OR public.knowledge_text_is_meaningful_guidance(k.attributes->>'guidance')
      OR public.knowledge_text_is_meaningful_guidance(k.attributes->>'notes')
      OR EXISTS (
        SELECT 1 FROM public.knowledge_sources s
        WHERE s.knowledge_id = k.id
          AND public.knowledge_url_is_http(s.url)
      )
      OR public.knowledge_url_is_http(k.provenance #>> '{intake_provenance,source_url}')
      OR public.knowledge_url_is_http(k.provenance->>'source_url')
    );
  RETURN COALESCE(v_count, 0);
END;
$$;

-- 4) Apply deterministic guidance from action/task into summary (no AI, no verify).
CREATE OR REPLACE FUNCTION public.admin_apply_deterministic_draft_guidance(
  p_knowledge_ids uuid[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  WITH targets AS (
    SELECT k.id,
      COALESCE(
        NULLIF(btrim(k.attributes->>'action'), ''),
        NULLIF(btrim(k.attributes->>'task'), ''),
        NULLIF(btrim(k.attributes->>'guidance'), ''),
        NULLIF(btrim(k.attributes->>'notes'), '')
      ) AS draft_text,
      CASE
        WHEN public.knowledge_text_is_meaningful_guidance(k.attributes->>'action') THEN 'imported_action'
        WHEN public.knowledge_text_is_meaningful_guidance(k.attributes->>'task') THEN 'imported_task'
        WHEN public.knowledge_text_is_meaningful_guidance(k.attributes->>'guidance') THEN 'imported_guidance'
        ELSE 'imported_notes'
      END AS draft_source
    FROM public.knowledge k
    WHERE k.status = 'candidate'
      AND k.scope = 'platform'
      AND (p_knowledge_ids IS NULL OR k.id = ANY(p_knowledge_ids))
      AND NOT public.knowledge_text_is_meaningful_guidance(k.summary)
      AND NOT public.knowledge_text_is_meaningful_guidance(k.body)
      AND (
        public.knowledge_text_is_meaningful_guidance(k.attributes->>'action')
        OR public.knowledge_text_is_meaningful_guidance(k.attributes->>'task')
        OR public.knowledge_text_is_meaningful_guidance(k.attributes->>'guidance')
        OR public.knowledge_text_is_meaningful_guidance(k.attributes->>'notes')
      )
  ),
  applied AS (
    UPDATE public.knowledge k
    SET
      summary = t.draft_text,
      provenance = k.provenance || jsonb_build_object(
        'guidance_draft', jsonb_build_object(
          'source', t.draft_source,
          'proposed_at', now(),
          'supported_by', jsonb_build_array('attributes.' || replace(t.draft_source, 'imported_', '')),
          'unverified', true
        ),
        'critic_passed', false,
        'critic_status', 'stale_after_guidance_edit'
      ),
      updated_at = now()
    FROM targets t
    WHERE k.id = t.id AND t.draft_text IS NOT NULL
    RETURNING k.id
  )
  SELECT count(*)::integer INTO v_updated FROM applied;

  RETURN jsonb_build_object('updated', COALESCE(v_updated, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_apply_deterministic_draft_guidance(uuid[])
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
