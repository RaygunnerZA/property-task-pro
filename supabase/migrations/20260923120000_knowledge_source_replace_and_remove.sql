-- Replace / remove Knowledge source URLs (including provenance-only orphans).
-- Platform admin only. Does not invent columns. Claims.source_id already ON DELETE SET NULL.

CREATE OR REPLACE FUNCTION public.knowledge_rewrite_provenance_url(
  p_knowledge_id uuid,
  p_old_url text,
  p_new_url text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prov jsonb;
  v_old text;
  v_new text;
BEGIN
  v_old := nullif(btrim(COALESCE(p_old_url, '')), '');
  v_new := nullif(btrim(COALESCE(p_new_url, '')), '');
  IF v_old IS NULL OR v_old IS NOT DISTINCT FROM v_new THEN
    RETURN;
  END IF;

  SELECT provenance INTO v_prov FROM public.knowledge WHERE id = p_knowledge_id;
  IF v_prov IS NULL THEN
    RETURN;
  END IF;

  IF COALESCE(v_prov->>'source_url', '') = v_old THEN
    IF v_new IS NULL THEN
      v_prov := v_prov - 'source_url';
    ELSE
      v_prov := v_prov || jsonb_build_object('source_url', v_new);
    END IF;
  END IF;

  IF COALESCE(v_prov->'intake_provenance'->>'source_url', '') = v_old THEN
    IF v_new IS NULL THEN
      v_prov := jsonb_set(v_prov, '{intake_provenance}', (v_prov->'intake_provenance') - 'source_url', true);
    ELSE
      v_prov := jsonb_set(v_prov, '{intake_provenance,source_url}', to_jsonb(v_new), true);
    END IF;
  END IF;

  UPDATE public.knowledge
  SET provenance = v_prov, updated_at = now()
  WHERE id = p_knowledge_id;
END;
$$;

COMMENT ON FUNCTION public.knowledge_rewrite_provenance_url(uuid, text, text) IS
  'Internal: rewrite or clear matching knowledge.provenance source URLs.';

REVOKE ALL ON FUNCTION public.knowledge_rewrite_provenance_url(uuid, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.admin_replace_knowledge_source_url(
  p_knowledge_id uuid,
  p_url text,
  p_previous_url text DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_source_id uuid DEFAULT NULL
) RETURNS public.knowledge_sources
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge_sources;
  v_new_url text;
  v_prev text;
  v_label text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.knowledge WHERE id = p_knowledge_id) THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  v_new_url := nullif(btrim(COALESCE(p_url, '')), '');
  v_prev := nullif(btrim(COALESCE(p_previous_url, '')), '');
  v_label := nullif(btrim(COALESCE(p_label, '')), '');

  IF v_new_url IS NULL OR v_new_url !~* '^https?://' THEN
    RAISE EXCEPTION 'invalid_source_url';
  END IF;

  IF p_source_id IS NOT NULL THEN
    SELECT * INTO v_row
    FROM public.knowledge_sources
    WHERE id = p_source_id;
    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'knowledge_source_not_found';
    END IF;
    IF v_row.knowledge_id IS DISTINCT FROM p_knowledge_id THEN
      RAISE EXCEPTION 'knowledge_source_mismatch';
    END IF;
  ELSIF v_prev IS NOT NULL THEN
    SELECT * INTO v_row
    FROM public.knowledge_sources
    WHERE knowledge_id = p_knowledge_id
      AND url = v_prev
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_row.id IS NOT NULL THEN
    UPDATE public.knowledge_sources
    SET
      url = v_new_url,
      label = COALESCE(v_label, v_row.label),
      source_type = CASE
        WHEN v_row.source_type IN ('manual', 'other', 'url') THEN 'url'
        ELSE v_row.source_type
      END,
      metadata = COALESCE(v_row.metadata, '{}'::jsonb) || jsonb_build_object(
        'url_updated_at', now(),
        'url_updated_by', auth.uid()
      )
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.knowledge_sources (
      knowledge_id, source_type, label, url, metadata
    ) VALUES (
      p_knowledge_id,
      'url',
      v_label,
      v_new_url,
      jsonb_build_object(
        'url_updated_at', now(),
        'url_updated_by', auth.uid(),
        'replaced_url', v_prev
      )
    )
    RETURNING * INTO v_row;
  END IF;

  IF v_prev IS NOT NULL THEN
    PERFORM public.knowledge_rewrite_provenance_url(p_knowledge_id, v_prev, v_new_url);
  END IF;

  PERFORM public.knowledge_invalidate_critic(p_knowledge_id, 'source_edit');

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'knowledge_source',
    v_row.id,
    'admin_replace_knowledge_source_url',
    jsonb_build_object(
      'knowledge_id', p_knowledge_id,
      'old_url', v_prev,
      'new_url', v_new_url,
      'label', v_row.label
    )
  );

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION public.admin_replace_knowledge_source_url(uuid, text, text, text, uuid) IS
  'Platform admin: replace a linked or provenance-only source URL in place.';

REVOKE ALL ON FUNCTION public.admin_replace_knowledge_source_url(uuid, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_replace_knowledge_source_url(uuid, text, text, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_remove_knowledge_source_url(
  p_knowledge_id uuid,
  p_source_id uuid DEFAULT NULL,
  p_url text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge_sources;
  v_url text;
  v_removed int := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.knowledge WHERE id = p_knowledge_id) THEN
    RAISE EXCEPTION 'knowledge_not_found';
  END IF;

  v_url := nullif(btrim(COALESCE(p_url, '')), '');

  IF p_source_id IS NOT NULL THEN
    SELECT * INTO v_row
    FROM public.knowledge_sources
    WHERE id = p_source_id;
    IF v_row.id IS NULL THEN
      RAISE EXCEPTION 'knowledge_source_not_found';
    END IF;
    IF v_row.knowledge_id IS DISTINCT FROM p_knowledge_id THEN
      RAISE EXCEPTION 'knowledge_source_mismatch';
    END IF;
    IF v_row.url IS NULL AND v_row.attachment_id IS NOT NULL THEN
      RAISE EXCEPTION 'source_not_url';
    END IF;
    v_url := COALESCE(v_url, v_row.url);
    DELETE FROM public.knowledge_sources WHERE id = v_row.id;
    v_removed := 1;
  ELSIF v_url IS NOT NULL THEN
    DELETE FROM public.knowledge_sources
    WHERE knowledge_id = p_knowledge_id AND url = v_url;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'source_url_required';
  END IF;

  IF v_url IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.knowledge_sources
    WHERE knowledge_id = p_knowledge_id AND url = v_url
  ) THEN
    PERFORM public.knowledge_rewrite_provenance_url(p_knowledge_id, v_url, NULL);
  END IF;

  PERFORM public.knowledge_invalidate_critic(p_knowledge_id, 'source_edit');

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    CASE WHEN v_row.id IS NULL THEN 'knowledge' ELSE 'knowledge_source' END,
    COALESCE(v_row.id, p_knowledge_id),
    'admin_remove_knowledge_source_url',
    jsonb_build_object(
      'knowledge_id', p_knowledge_id,
      'source_id', v_row.id,
      'url', v_url,
      'rows_removed', v_removed
    )
  );

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.admin_remove_knowledge_source_url(uuid, uuid, text) IS
  'Platform admin: remove a linked source URL or a provenance-only orphan URL.';

REVOKE ALL ON FUNCTION public.admin_remove_knowledge_source_url(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_remove_knowledge_source_url(uuid, uuid, text) TO authenticated, service_role;

-- Keep update in lockstep: reuse provenance rewrite.
CREATE OR REPLACE FUNCTION public.admin_update_knowledge_source(
  p_source_id uuid,
  p_url text DEFAULT NULL,
  p_label text DEFAULT NULL
) RETURNS public.knowledge_sources
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.knowledge_sources;
  v_old_url text;
  v_new_url text;
  v_new_label text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT * INTO v_row FROM public.knowledge_sources WHERE id = p_source_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'knowledge_source_not_found';
  END IF;

  v_old_url := v_row.url;
  v_new_url := CASE
    WHEN p_url IS NULL THEN v_row.url
    ELSE nullif(btrim(p_url), '')
  END;
  v_new_label := CASE
    WHEN p_label IS NULL THEN v_row.label
    ELSE nullif(btrim(p_label), '')
  END;

  IF v_new_url IS NOT NULL AND v_new_url !~* '^https?://' THEN
    RAISE EXCEPTION 'invalid_source_url';
  END IF;

  IF v_new_url IS NULL AND v_row.attachment_id IS NULL AND v_row.external_ref IS NULL THEN
    RAISE EXCEPTION 'source_url_required';
  END IF;

  UPDATE public.knowledge_sources
  SET
    url = v_new_url,
    label = v_new_label,
    source_type = CASE
      WHEN v_new_url IS NOT NULL AND v_row.source_type IN ('manual', 'other', 'url') THEN 'url'
      ELSE v_row.source_type
    END,
    metadata = COALESCE(v_row.metadata, '{}'::jsonb) || jsonb_build_object(
      'url_updated_at', now(),
      'url_updated_by', auth.uid()
    )
  WHERE id = p_source_id
  RETURNING * INTO v_row;

  IF v_old_url IS NOT NULL AND v_new_url IS DISTINCT FROM v_old_url THEN
    PERFORM public.knowledge_rewrite_provenance_url(v_row.knowledge_id, v_old_url, v_new_url);
  END IF;

  PERFORM public.knowledge_invalidate_critic(v_row.knowledge_id, 'source_edit');

  INSERT INTO public.audit_logs (org_id, actor_id, entity_type, entity_id, action, metadata)
  VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    auth.uid(),
    'knowledge_source',
    v_row.id,
    'admin_update_knowledge_source',
    jsonb_build_object(
      'knowledge_id', v_row.knowledge_id,
      'old_url', v_old_url,
      'new_url', v_new_url,
      'label', v_new_label
    )
  );

  RETURN v_row;
END;
$$;
