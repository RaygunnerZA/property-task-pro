-- Raise claim capacity; allow re-extract from sources without wiping human-verified claims.

CREATE OR REPLACE FUNCTION public.insert_knowledge_claims(
  p_knowledge_id uuid,
  p_claims jsonb DEFAULT '[]'::jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_k public.knowledge;
  v_item jsonb;
  v_text text;
  v_category text;
  v_status text;
  v_established boolean;
  v_order integer := 0;
  v_count integer := 0;
  v_source uuid;
  v_max integer := 80;
BEGIN
  SELECT * INTO v_k FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_k.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  IF p_claims IS NULL OR jsonb_typeof(p_claims) <> 'array' THEN
    RETURN 0;
  END IF;

  SELECT s.id INTO v_source
  FROM public.knowledge_sources s
  WHERE s.knowledge_id = p_knowledge_id
  ORDER BY CASE WHEN s.source_type = 'url' THEN 0 ELSE 1 END, s.created_at
  LIMIT 1;

  SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_order
  FROM public.knowledge_claims
  WHERE knowledge_id = p_knowledge_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_claims)
  LOOP
    IF v_count >= v_max THEN
      EXIT;
    END IF;

    v_text := nullif(btrim(COALESCE(v_item->>'claim_text', v_item->>'text', '')), '');
    IF v_text IS NULL OR length(v_text) < 4 THEN
      CONTINUE;
    END IF;

    v_established := COALESCE((v_item->>'established')::boolean, true);
    v_status := lower(btrim(COALESCE(v_item->>'verification_status', '')));
    IF NOT v_established THEN
      v_status := 'unknown';
    ELSIF v_status NOT IN ('extracted','verified','unresolved','unknown','rejected') THEN
      v_status := 'extracted';
    END IF;

    v_category := lower(btrim(COALESCE(v_item->>'category', 'other')));
    IF v_status = 'unknown' THEN
      v_category := 'unknown';
    ELSIF v_category NOT IN (
      'obligation','applicability','responsibility','standard','testing',
      'replacement','evidence','exception','consequence','unknown','other'
    ) THEN
      v_category := 'other';
    END IF;

    INSERT INTO public.knowledge_claims (
      knowledge_id, org_id, claim_text, category, applicability, source_id,
      source_location, verification_status, confidence, critic_result, sort_order
    ) VALUES (
      v_k.id,
      v_k.org_id,
      left(v_text, 500),
      v_category,
      CASE
        WHEN jsonb_typeof(v_item->'applicability') = 'object' THEN v_item->'applicability'
        ELSE '{}'::jsonb
      END,
      COALESCE(
        NULLIF(v_item->>'source_id', '')::uuid,
        v_source
      ),
      nullif(left(btrim(COALESCE(v_item->>'source_location', '')), 240), ''),
      v_status,
      CASE
        WHEN (v_item->>'confidence') ~ '^[0-9]+(\.[0-9]+)?$' THEN
          LEAST(1, GREATEST(0, (v_item->>'confidence')::numeric))
        ELSE NULL
      END,
      CASE
        WHEN jsonb_typeof(v_item->'critic_result') = 'object' THEN v_item->'critic_result'
        ELSE '{}'::jsonb
      END,
      v_order
    );

    v_order := v_order + 1;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Replace non-verified claims after source re-extraction. Keeps verified/rejected.
CREATE OR REPLACE FUNCTION public.replace_knowledge_extracted_claims(
  p_knowledge_id uuid,
  p_claims jsonb DEFAULT '[]'::jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_k public.knowledge;
  v_inserted integer := 0;
BEGIN
  IF NOT public.is_platform_admin() AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT * INTO v_k FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_k.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  DELETE FROM public.knowledge_claims
  WHERE knowledge_id = p_knowledge_id
    AND verification_status IN ('extracted', 'unknown', 'unresolved');

  v_inserted := public.insert_knowledge_claims(p_knowledge_id, p_claims);

  INSERT INTO public.knowledge_verification_events (knowledge_id, org_id, event_type, actor_id, payload)
  VALUES (
    p_knowledge_id,
    v_k.org_id,
    'human_edit',
    auth.uid(),
    jsonb_build_object(
      'via', 'replace_knowledge_extracted_claims',
      'inserted_count', v_inserted
    )
  );

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_knowledge_extracted_claims(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_knowledge_extracted_claims(uuid, jsonb)
  TO authenticated, service_role;
