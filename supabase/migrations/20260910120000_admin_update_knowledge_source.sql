-- Allow platform admins to edit Knowledge source URLs/labels from review.
-- Previously only admin_add_knowledge_source existed; Sources UI was read-only.

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
  v_prov jsonb;
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

  -- Keep orphan provenance URL in sync when it matched the previous URL.
  SELECT provenance INTO v_prov FROM public.knowledge WHERE id = v_row.knowledge_id;
  IF v_prov IS NOT NULL AND v_old_url IS NOT NULL AND v_new_url IS DISTINCT FROM v_old_url THEN
    IF COALESCE(v_prov->>'source_url', '') = v_old_url THEN
      v_prov := v_prov || jsonb_build_object('source_url', v_new_url);
    END IF;
    IF COALESCE(v_prov->'intake_provenance'->>'source_url', '') = v_old_url THEN
      v_prov := jsonb_set(
        v_prov,
        '{intake_provenance,source_url}',
        to_jsonb(v_new_url),
        true
      );
    END IF;
    UPDATE public.knowledge
    SET provenance = v_prov, updated_at = now()
    WHERE id = v_row.knowledge_id;
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

COMMENT ON FUNCTION public.admin_update_knowledge_source(uuid, text, text) IS
  'Platform admin: update knowledge_sources url/label; invalidates critic; audits to platform sentinel org.';

REVOKE ALL ON FUNCTION public.admin_update_knowledge_source(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_knowledge_source(uuid, text, text) TO authenticated, service_role;
